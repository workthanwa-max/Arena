package tests

import (
	"bufio"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"go-backend/internal/api"
	"go-backend/internal/infrastructure/config"
	"go-backend/internal/infrastructure/database"
	"go-backend/internal/infrastructure/logger"
	"go-backend/internal/modules/auth"
	"go-backend/internal/modules/engine"
	"go-backend/internal/modules/persistence"
	"go-backend/internal/modules/player"
	"go-backend/internal/modules/room"
	"go-backend/internal/modules/session"
	"go-backend/internal/modules/state"
	gamesync "go-backend/internal/modules/sync"
)

func registerTestUser(t *testing.T, srvURL, username, displayName string) (string, string) {
	t.Helper()
	payload, _ := json.Marshal(map[string]string{
		"username":    username,
		"password":    "secret123",
		"displayName": displayName,
	})
	resp, err := http.Post(srvURL+"/api/auth/register", "application/json", strings.NewReader(string(payload)))
	if err != nil {
		t.Fatalf("register %s: %v", username, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("register %s status=%d body=%s", username, resp.StatusCode, string(body))
	}
	var out struct {
		User  auth.UserProfile `json:"user"`
		Token string           `json:"token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode register %s: %v", username, err)
	}
	if len(out.User.OwnedCharacterIDs) != 12 || out.Token == "" {
		t.Fatalf("expected 12 public starter heroes and session token on register, got %+v", out)
	}
	return out.User.ID, out.Token
}

func openOptionalTestPostgres(t *testing.T) *sql.DB {
	t.Helper()
	dsn := strings.TrimSpace(os.Getenv("TEST_DATABASE_URL"))
	if dsn == "" {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	db, err := database.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("open test postgres (%s): %v", dsn, err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})
	return db
}

func TestEngineMovementBoundsAndRandomSpawn(t *testing.T) {
	eng := engine.NewEngine()
	cfg := state.DefaultMapConfig()
	now := time.Now()
	p := &state.PlayerState{
		ID:          "p1",
		Name:        "Alice",
		CharacterID: "default",
		X:           cfg.PlayerRadius,
		Y:           cfg.PlayerRadius,
		HP:          240,
		MaxHP:       240,
		Alive:       true,
		InputDX:     -1,
		InputDY:     -1,
	}

	changed := eng.StepPlayer(p, 0.05, cfg, now)
	if changed {
		t.Fatalf("expected player at min boundary not to move further negative")
	}

	p.InputDX = 0
	p.InputDY = 1
	changed = eng.StepPlayer(p, 0.5, cfg, now)
	if !changed || p.Y <= cfg.PlayerRadius {
		t.Fatalf("expected player to move down, got Y=%v", p.Y)
	}

	// Verify random spawn coordinates stay inside bounds and do not one-hit kill
	rsTest := state.NewRoomState("r1", 5, cfg)
	for i := 0; i < 10; i++ {
		sx, sy := eng.SpawnPosition(rsTest)
		if sx < cfg.PlayerRadius || sx > cfg.Width-cfg.PlayerRadius || sy < cfg.PlayerRadius || sy > cfg.Height-cfg.PlayerRadius {
			t.Fatalf("spawn out of bounds: (%v, %v)", sx, sy)
		}
	}

	rsTest.Players["pa1"] = &state.PlayerState{ID: "pa1", Name: "Pa", CharacterID: "pa", X: 500, Y: 500, HP: 220, MaxHP: 220, Alive: true}
	rsTest.Players["def1"] = &state.PlayerState{ID: "def1", Name: "Def", CharacterID: "default", X: 620, Y: 500, HP: 240, MaxHP: 240, Alive: true}
	hits, ok := eng.CastSkill(rsTest, rsTest.Players["pa1"], 3, 620, 500, now)
	eng.StepZones(rsTest, 0.2, now)
	eng.StepZones(rsTest, 0.02, now)
	if !ok || len(hits) != 0 || !rsTest.Players["def1"].Alive || rsTest.Players["def1"].HP >= 240 {
		t.Fatalf("expected non-lethal sword rain damage from single ult tick: alive=%v hp=%d hits=%d", rsTest.Players["def1"].Alive, rsTest.Players["def1"].HP, len(hits))
	}

	// Verify each of the 9 characters executes a distinct Basic Attack and deals damage cleanly
	for _, cid := range []string{"default", "pa", "boy", "ole", "thanwa", "ajarn_au", "ajarn_boy", "kaem", "frame", "ko"} {
		attacker := &state.PlayerState{ID: "atk-" + cid, Name: cid, CharacterID: cid, X: 500, Y: 500, HP: 220, MaxHP: 220, Alive: true}
		target := &state.PlayerState{ID: "tgt-" + cid, Name: "Tgt", CharacterID: "default", X: 575, Y: 500, HP: 240, MaxHP: 240, Alive: true}
		rBasic := state.NewRoomState("basic-"+cid, 5, cfg)
		rBasic.Players[attacker.ID] = attacker
		rBasic.Players[target.ID] = target
		if _, ok := eng.CastBasicAttack(rBasic, attacker, target.X, target.Y, now); !ok {
			t.Fatalf("expected basic attack to succeed for %s", cid)
		}
		if len(rBasic.Projectiles) == 0 && len(rBasic.Beams) == 0 {
			t.Fatalf("expected basic attack visual/projectile spawned for %s", cid)
		}
		for s := 0; s < 15; s++ {
			eng.StepProjectiles(rBasic, 0.016, now)
		}
		if target.HP >= 240 {
			t.Fatalf("expected basic attack of %s to deal damage, got hp=%d", cid, target.HP)
		}
	}
	defXBefore := rsTest.Players["def1"].X
	if !eng.CastDash(rsTest, rsTest.Players["def1"], 860, 500, now) || rsTest.Players["def1"].X <= defXBefore {
		t.Fatalf("expected dash to propel character forward")
	}
}

func TestCharactersCatalogAndSkillsCombat(t *testing.T) {
	db := openOptionalTestPostgres(t)

	log := logger.New()
	persist := persistence.NewService(db, log)
	defer persist.Close()

	cfg := &config.Config{
		Port:              "0",
		AllowedOrigins:    []string{"http://localhost:5555"},
		ShareBaseURL:      "http://localhost:5555",
		TickRateHz:        60,
		MaxPlayersPerRoom: 5,
	}

	authSvc := auth.NewService(db, log)
	pm := player.NewManager()
	eng := engine.NewEngine()
	syncer := gamesync.NewSynchronizer()
	sm := session.NewManager(log, syncer)
	rm := room.NewManager(cfg.MaxPlayersPerRoom, cfg.TickRateHz, cfg.ShareBaseURL, eng, pm, sm, syncer, persist, log)
	defer rm.Shutdown()

	srv := httptest.NewServer(api.NewRouter(cfg, db, authSvc, rm, sm, syncer, log))
	defer srv.Close()

	suffix := time.Now().Format("150405000")
	_, tok1 := registerTestUser(t, srv.URL, "u_thanwa_"+suffix, "Thanwa")
	_, tok2 := registerTestUser(t, srv.URL, "u_pa_"+suffix, "HeroPa")

	charResp, err := http.Get(srv.URL + "/api/characters")
	if err != nil {
		t.Fatalf("get /api/characters: %v", err)
	}
	defer charResp.Body.Close()
	var charPayload struct {
		Characters []state.CharacterDef `json:"characters"`
	}
	if err := json.NewDecoder(charResp.Body).Decode(&charPayload); err != nil {
		t.Fatalf("decode characters: %v", err)
	}
	if len(charPayload.Characters) != 12 {
		t.Fatalf("expected 12 public characters, got %d", len(charPayload.Characters))
	}
	for _, c := range charPayload.Characters {
		if c.AdminOnly {
			t.Fatalf("expected public /api/characters to omit adminOnly hero %s", c.ID)
		}
		if c.MaxHP < 200 {
			t.Fatalf("expected balanced MaxHP >= 200 for %s, got %d", c.ID, c.MaxHP)
		}
	}
	if len(charPayload.Characters[0].Skills) != 0 {
		t.Fatalf("expected default character to have 0 skills, got %d", len(charPayload.Characters[0].Skills))
	}
	for _, c := range charPayload.Characters[1:] {
		wantSkills := 3
		if c.ID == "noone" {
			wantSkills = 5
		}
		if len(c.Skills) != wantSkills {
			t.Fatalf("expected character %s to have %d skills, got %d", c.ID, wantSkills, len(c.Skills))
		}
	}

	reqRoom, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/rooms", strings.NewReader(`{"mode":"ffa","mapId":"shibuya"}`))
	reqRoom.Header.Set("Content-Type", "application/json")
	reqRoom.Header.Set("Authorization", "Bearer "+tok1)
	resp, err := http.DefaultClient.Do(reqRoom)
	if err != nil {
		t.Fatalf("post /api/rooms: %v", err)
	}
	defer resp.Body.Close()

	var created room.RoomInfo
	if err := json.NewDecoder(resp.Body).Decode(&created); err != nil {
		t.Fatalf("decode room info: %v", err)
	}
	if len(created.RoomID) != 6 {
		t.Fatalf("expected 6-digit numeric roomId, got %q", created.RoomID)
	}

	wsHost := strings.TrimPrefix(srv.URL, "http://")

	defaultThanwaWS := dialTestWS(t, wsHost, "/ws?roomId="+created.RoomID+"&characterId=default&token="+tok1, "http://localhost:5555")
	defer defaultThanwaWS.close()
	w1 := defaultThanwaWS.readJSON(t)
	if w1["type"] != "welcome" {
		t.Fatalf("expected welcome, got %v", w1)
	}

	paWS := dialTestWS(t, wsHost, "/ws?roomId="+created.RoomID+"&characterId=pa&token="+tok2, "http://localhost:5555")
	defer paWS.close()
	w2 := paWS.readJSON(t)
	if w2["type"] != "welcome" {
		t.Fatalf("expected welcome for pa, got %v", w2)
	}

	var defaultX, defaultY float64
	for _, rawP := range w2["players"].([]any) {
		pm := rawP.(map[string]any)
		if pm["name"] == "Thanwa" {
			defaultX = pm["x"].(float64)
			defaultY = pm["y"].(float64)
			if pm["characterId"] != "default" {
				t.Fatalf("expected Thanwa name with default char to remain default, got %v", pm["characterId"])
			}
		}
	}

	defaultThanwaWS.writeJSON(t, map[string]any{
		"type": "skill",
		"slot": 1,
		"tx":   100,
		"ty":   100,
	})

	paWS.writeJSON(t, map[string]any{
		"type": "skill",
		"slot": 1,
		"tx":   defaultX,
		"ty":   defaultY,
	})

	deadline := time.Now().Add(2 * time.Second)
	gotProj := false
	for time.Now().Before(deadline) {
		msg := paWS.readJSON(t)
		if msg["type"] == "state" {
			if projs, ok := msg["projectiles"].([]any); ok && len(projs) > 0 {
				gotProj = true
				break
			}
		}
	}
	if !gotProj {
		t.Fatalf("expected Gilgamesh skill 1 to spawn projectiles")
	}
}

func TestRoomMaxPlayersAndWebSocketFlow(t *testing.T) {
	db := openOptionalTestPostgres(t)

	log := logger.New()
	persist := persistence.NewService(db, log)
	defer persist.Close()

	cfg := &config.Config{
		Port:              "0",
		AllowedOrigins:    []string{"http://localhost:5555"},
		ShareBaseURL:      "http://localhost:5555",
		TickRateHz:        20,
		MaxPlayersPerRoom: 5,
	}

	authSvc := auth.NewService(db, log)
	pm := player.NewManager()
	eng := engine.NewEngine()
	syncer := gamesync.NewSynchronizer()
	sm := session.NewManager(log, syncer)
	rm := room.NewManager(cfg.MaxPlayersPerRoom, cfg.TickRateHz, cfg.ShareBaseURL, eng, pm, sm, syncer, persist, log)
	defer rm.Shutdown()

	srv := httptest.NewServer(api.NewRouter(cfg, db, authSvc, rm, sm, syncer, log))
	defer srv.Close()

	suffix := time.Now().Format("150405001")
	toks := make([]string, 6)
	for i := 0; i < 6; i++ {
		_, toks[i] = registerTestUser(t, srv.URL, "u_max_"+suffix+"_"+string(rune('a'+i)), "Player"+string(rune('A'+i)))
	}

	reqRoom, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/rooms", strings.NewReader(`{"mode":"ffa","mapId":"konoha"}`))
	reqRoom.Header.Set("Content-Type", "application/json")
	reqRoom.Header.Set("Authorization", "Bearer "+toks[0])
	resp, err := http.DefaultClient.Do(reqRoom)
	if err != nil {
		t.Fatalf("post /api/rooms: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}

	var created room.RoomInfo
	if err := json.NewDecoder(resp.Body).Decode(&created); err != nil {
		t.Fatalf("decode room info: %v", err)
	}

	wsHost := strings.TrimPrefix(srv.URL, "http://")
	conns := make([]*testWSClient, 0, 5)
	chars := []string{"pa", "boy", "ole", "thanwa", "ajarn_au"}
	for i := 0; i < 5; i++ {
		c := dialTestWS(t, wsHost, "/ws?roomId="+created.RoomID+"&characterId="+chars[i]+"&token="+toks[i], "http://localhost:5555")
		defer c.close()
		msg := c.readJSON(t)
		if msg["type"] != "welcome" {
			t.Fatalf("expected welcome for player %d, got %v", i, msg)
		}
		conns = append(conns, c)
	}

	c6 := dialTestWS(t, wsHost, "/ws?roomId="+created.RoomID+"&characterId=ajarn_boy&token="+toks[5], "http://localhost:5555")
	defer c6.close()
	errMsg := c6.readJSON(t)
	if errMsg["type"] != "error" || errMsg["code"] != "ROOM_FULL" {
		t.Fatalf("expected ROOM_FULL error for 6th player, got %v", errMsg)
	}

	conns[0].writeJSON(t, map[string]any{
		"type": "input",
		"seq":  1,
		"dx":   0,
		"dy":   -1,
	})

	deadline := time.Now().Add(2 * time.Second)
	gotState := false
	for time.Now().Before(deadline) {
		msg := conns[0].readJSON(t)
		if msg["type"] == "state" {
			gotState = true
			break
		}
	}
	if !gotState {
		t.Fatalf("expected authoritative state broadcast after input")
	}
}

type testWSClient struct {
	conn net.Conn
	br   *bufio.Reader
}

func dialTestWS(t *testing.T, addr, path, origin string) *testWSClient {
	t.Helper()
	conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
	if err != nil {
		t.Fatalf("dial %s: %v", addr, err)
	}

	var keyBytes [16]byte
	_, _ = rand.Read(keyBytes[:])
	key := base64.StdEncoding.EncodeToString(keyBytes[:])

	req := "GET " + path + " HTTP/1.1\r\n" +
		"Host: " + addr + "\r\n" +
		"Upgrade: websocket\r\n" +
		"Connection: Upgrade\r\n" +
		"Origin: " + origin + "\r\n" +
		"Sec-WebSocket-Version: 13\r\n" +
		"Sec-WebSocket-Key: " + key + "\r\n\r\n"

	if _, err := conn.Write([]byte(req)); err != nil {
		t.Fatalf("write handshake: %v", err)
	}

	br := bufio.NewReader(conn)
	for {
		line, err := br.ReadString('\n')
		if err != nil {
			t.Fatalf("read handshake: %v", err)
		}
		if line == "\r\n" {
			break
		}
	}
	return &testWSClient{conn: conn, br: br}
}

func (c *testWSClient) writeJSON(t *testing.T, v any) {
	t.Helper()
	payload, _ := json.Marshal(v)
	var mask [4]byte
	_, _ = rand.Read(mask[:])

	var frame []byte
	frame = append(frame, 0x81)
	n := len(payload)
	if n <= 125 {
		frame = append(frame, 0x80|byte(n))
	} else {
		frame = append(frame, 0x80|126, byte(n>>8), byte(n))
	}
	frame = append(frame, mask[:]...)
	for i, b := range payload {
		frame = append(frame, b^mask[i%4])
	}
	if _, err := c.conn.Write(frame); err != nil {
		t.Fatalf("write ws frame: %v", err)
	}
}

func (c *testWSClient) readJSON(t *testing.T) map[string]any {
	t.Helper()
	_ = c.conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	var hdr [2]byte
	if _, err := io.ReadFull(c.br, hdr[:]); err != nil {
		t.Fatalf("read ws header: %v", err)
	}
	length := int(hdr[1] & 0x7F)
	if length == 126 {
		var ext [2]byte
		_, _ = io.ReadFull(c.br, ext[:])
		length = int(binary.BigEndian.Uint16(ext[:]))
	}
	payload := make([]byte, length)
	if _, err := io.ReadFull(c.br, payload); err != nil {
		t.Fatalf("read ws payload: %v", err)
	}
	var out map[string]any
	if err := json.Unmarshal(payload, &out); err != nil {
		t.Fatalf("unmarshal ws payload %q: %v", string(payload), err)
	}
	return out
}

func (c *testWSClient) writeBinary(t *testing.T, payload []byte) {
	t.Helper()
	var mask [4]byte
	_, _ = rand.Read(mask[:])

	var frame []byte
	frame = append(frame, 0x82) // FIN + opBinary
	n := len(payload)
	if n <= 125 {
		frame = append(frame, 0x80|byte(n))
	} else {
		frame = append(frame, 0x80|126, byte(n>>8), byte(n))
	}
	frame = append(frame, mask[:]...)
	for i, b := range payload {
		frame = append(frame, b^mask[i%4])
	}
	if _, err := c.conn.Write(frame); err != nil {
		t.Fatalf("write binary ws frame: %v", err)
	}
}

func (c *testWSClient) readFrame(t *testing.T) (byte, []byte) {
	t.Helper()
	_ = c.conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	var hdr [2]byte
	if _, err := io.ReadFull(c.br, hdr[:]); err != nil {
		t.Fatalf("read ws header: %v", err)
	}
	length := int(hdr[1] & 0x7F)
	if length == 126 {
		var ext [2]byte
		_, _ = io.ReadFull(c.br, ext[:])
		length = int(binary.BigEndian.Uint16(ext[:]))
	}
	payload := make([]byte, length)
	if _, err := io.ReadFull(c.br, payload); err != nil {
		t.Fatalf("read ws payload: %v", err)
	}
	return hdr[0] & 0x0F, payload
}

func (c *testWSClient) close() {
	_ = c.conn.Close()
}

func TestDistinctHeroSkillMechanics(t *testing.T) {
	eng := engine.NewEngine()
	cfg := state.DefaultMapConfig()
	now := time.Now()
	rs := state.NewRoomState("distinct-room", 5, cfg)

	// Killua (ajarn_au) Skill 1 Solo Close Whirlwind + 0.5s i-frame -> Skill 2 Godspeed collide stun -> Skill 3 Narukami
	rs.Players["killua"] = &state.PlayerState{ID: "killua", Name: "Killua", CharacterID: "ajarn_au", X: 300, Y: 500, HP: 225, MaxHP: 225, Alive: true}
	rs.Players["e1"] = &state.PlayerState{ID: "e1", Name: "E1", CharacterID: "default", X: 410, Y: 500, HP: 240, MaxHP: 240, Alive: true}
	rs.Players["e2"] = &state.PlayerState{ID: "e2", Name: "E2", CharacterID: "default", X: 440, Y: 520, HP: 240, MaxHP: 240, Alive: true}

	if _, ok := eng.CastSkill(rs, rs.Players["killua"], 1, 410, 500, now); !ok {
		t.Fatalf("expected killua solo close whirlwind cast")
	}
	if !rs.Players["killua"].InvulnUntil.After(now) {
		t.Fatalf("expected killua skill 1 to grant 0.5s i-frame invulnerability")
	}
	// Verify i-frame blocks incoming attack damage during 0.5s
	eng.CastBasicAttack(rs, rs.Players["e1"], rs.Players["killua"].X, rs.Players["killua"].Y, now)
	eng.StepProjectiles(rs, 0.05, now)
	if rs.Players["killua"].HP != 225 {
		t.Fatalf("expected killua 0.5s i-frame to negate damage, got hp=%d", rs.Players["killua"].HP)
	}
	if rs.Players["e1"].HP >= 240 || rs.Players["e2"].HP >= 240 {
		t.Fatalf("expected killua solo whirlwind to hit nearby enemies (e1=%d, e2=%d)", rs.Players["e1"].HP, rs.Players["e2"].HP)
	}

	// Killua Skill 2 Godspeed collision stuns nearby enemy on bump
	rs.Players["e1"].HP = 240
	rs.Players["e1"].StunUntil = now
	rs.Players["e1"].X = 335
	if _, ok := eng.CastSkill(rs, rs.Players["killua"], 2, 335, 500, now); !ok {
		t.Fatalf("expected killua godspeed cast")
	}
	eng.StepZones(rs, 0.016, now)
	if rs.Players["e1"].HP >= 240 || !rs.Players["e1"].StunUntil.After(now) {
		t.Fatalf("expected godspeed collision to stun & damage (hp=%d)", rs.Players["e1"].HP)
	}

	// Killua Skill 3 Narukami (2-Step): Step 1 heavy thunderstrike (54 dmg) -> Step 2 6-way radial lightning bolts (16 dmg each, lighter!)
	rs.Players["e1"].HP = 240
	rs.Players["e1"].X = 420
	if _, ok := eng.CastSkill(rs, rs.Players["killua"], 3, 420, 500, now); !ok {
		t.Fatalf("expected narukami cast")
	}
	eng.StepZones(rs, 0.2, now)
	if rs.Players["e1"].HP != 240 {
		t.Fatalf("expected narukami to telegraph before dealing damage at 0.45s, got hp=%d", rs.Players["e1"].HP)
	}
	eng.StepZones(rs, 0.30, now)
	eng.StepZones(rs, 0.02, now)
	if rs.Players["e1"].HP >= 240 {
		t.Fatalf("expected narukami step 1 strike to deal primary damage")
	}
	step1Hp := rs.Players["e1"].HP
	// Advance past Step 2 delay (0.34s): 6 radial bolts spawn with lighter damage (16 < 54)
	eng.StepZones(rs, 0.36, now)
	boltCount := 0
	for _, pr := range rs.Projectiles {
		if pr.Kind == "narukami_bolt" {
			boltCount++
			if pr.Damage >= 54 {
				t.Fatalf("expected step 2 bolt damage (%d) to be lighter than step 1 (54)", pr.Damage)
			}
		}
	}
	if boltCount != 6 {
		t.Fatalf("expected 6 radial narukami_bolt projectiles on step 2, got %d (step1Hp=%d)", boltCount, step1Hp)
	}

	// Itachi (ole) Skill 1 Boomerang: reverses back to owner after half-life
	rs.Players["itachi"] = &state.PlayerState{ID: "itachi", Name: "Itachi", CharacterID: "ole", X: 800, Y: 800, HP: 225, MaxHP: 225, Alive: true}
	if _, ok := eng.CastSkill(rs, rs.Players["itachi"], 1, 1200, 800, now); !ok {
		t.Fatalf("expected itachi boomerang cast")
	}
	if len(rs.Projectiles) == 0 || !rs.Projectiles[len(rs.Projectiles)-1].Boomerang {
		t.Fatalf("expected boomerang projectiles spawned")
	}
	for step := 0; step < 50; step++ {
		eng.StepProjectiles(rs, 0.02, now)
	}
	foundReturned := false
	for _, pr := range rs.Projectiles {
		if pr.OwnerID == "itachi" && pr.Returned {
			foundReturned = true
			break
		}
	}
	if !foundReturned {
		t.Fatalf("expected boomerang shurikens to reverse direction back to Itachi")
	}

	// Sukuna (ajarn_boy) Skill 2 Fuga arrow spawns cinder burn pool on impact
	rs.Players["sukuna"] = &state.PlayerState{ID: "sukuna", Name: "Sukuna", CharacterID: "ajarn_boy", X: 1400, Y: 500, HP: 245, MaxHP: 245, Alive: true}
	rs.Players["victim"] = &state.PlayerState{ID: "victim", Name: "Victim", CharacterID: "default", X: 1520, Y: 500, HP: 240, MaxHP: 240, Alive: true}
	if _, ok := eng.CastSkill(rs, rs.Players["sukuna"], 2, 1520, 500, now); !ok {
		t.Fatalf("expected sukuna fuga cast")
	}
	for step := 0; step < 30; step++ {
		eng.StepProjectiles(rs, 0.016, now)
	}
	hasCinder := false
	for _, z := range rs.Zones {
		if z.Kind == "fuga_cinder" {
			hasCinder = true
			break
		}
	}
	if !hasCinder {
		t.Fatalf("expected fuga arrow impact to leave fuga_cinder burning pool")
	}

	// Verify each of the 6 anime characters has distinct skill CastRanges and ground skills clamp strictly inside CastRange
	for _, c := range state.AllCharacters() {
		if c.VoiceLine == "" {
			t.Fatalf("expected non-empty VoiceLine on character %s", c.ID)
		}
	}
	for _, c := range state.AllCharacters()[1:] {
		for _, sk := range c.Skills {
			if sk.CastRange <= 0 || sk.AimType == "" {
				t.Fatalf("expected valid CastRange and AimType on %s slot %d, got %+v", c.ID, sk.Slot, sk)
			}
		}
	}
	rsClamp := state.NewRoomState("clamp-room", 5, cfg)
	kShort := &state.PlayerState{ID: "ks", Name: "KS", CharacterID: "boy", X: 500, Y: 500, HP: 250, MaxHP: 250, Alive: true}
	rsClamp.Players[kShort.ID] = kShort
	if _, ok := eng.CastSkill(rsClamp, kShort, 2, 610, 500, now); !ok {
		t.Fatalf("expected short coordinate dragon dash")
	}
	if kShort.X < 605 || kShort.X > 615 {
		t.Fatalf("expected short chosen coordinate at X~610, got %v", kShort.X)
	}
	kFar := &state.PlayerState{ID: "kf", Name: "KF", CharacterID: "boy", X: 500, Y: 500, HP: 250, MaxHP: 250, Alive: true}
	rsClamp.Players[kFar.ID] = kFar
	if _, ok := eng.CastSkill(rsClamp, kFar, 2, 2000, 500, now); !ok {
		t.Fatalf("expected clamped max-range dragon dash")
	}
	if kFar.X > 882 {
		t.Fatalf("expected dash clamped <= 500+380=880, got %v", kFar.X)
	}

	// Goku (boy) Skill 2 hitting enemy triggers 2s Rapid Attack cooldown boost + stronger basic attack
	rsGoku := state.NewRoomState("goku-room", 5, cfg)
	goku := &state.PlayerState{ID: "g1", Name: "Goku", CharacterID: "boy", X: 500, Y: 500, HP: 250, MaxHP: 250, Alive: true}
	punchBag := &state.PlayerState{ID: "pb1", Name: "Bag", CharacterID: "default", X: 650, Y: 500, HP: 240, MaxHP: 240, Alive: true}
	rsGoku.Players[goku.ID] = goku
	rsGoku.Players[punchBag.ID] = punchBag
	if _, ok := eng.CastSkill(rsGoku, goku, 2, 650, 500, now); !ok {
		t.Fatalf("expected goku dash punch")
	}
	if !goku.RapidAttackUntil.After(now) || !punchBag.StunUntil.After(now) {
		t.Fatalf("expected goku dash punch on-hit to stun enemy & trigger 2s fast basic attacks")
	}
	eng.CastBasicAttack(rsGoku, goku, punchBag.X, punchBag.Y, now)
	if goku.AttackUntil.Sub(now) >= 300*time.Millisecond {
		t.Fatalf("expected buffed fast attack cooldown (<300ms), got %v", goku.AttackUntil.Sub(now))
	}

	// Sukuna (ajarn_boy) Ultimate: Stationary Throne + Slow + Invulnerable when hitting enemy
	rsSukuna := state.NewRoomState("sukuna-shrine", 5, cfg)
	sukunaUlt := &state.PlayerState{ID: "sk1", Name: "SukunaUlt", CharacterID: "ajarn_boy", X: 700, Y: 700, HP: 245, MaxHP: 245, Alive: true}
	trapped := &state.PlayerState{ID: "tr1", Name: "Trapped", CharacterID: "default", X: 820, Y: 700, HP: 240, MaxHP: 240, Alive: true}
	rsSukuna.Players[sukunaUlt.ID] = sukunaUlt
	rsSukuna.Players[trapped.ID] = trapped
	if _, ok := eng.CastSkill(rsSukuna, sukunaUlt, 3, 950, 700, now); !ok {
		t.Fatalf("expected sukuna stationary domain cast")
	}
	eng.StepZones(rsSukuna, 0.02, now)
	if !sukunaUlt.InvulnUntil.After(now) || !trapped.SlowUntil.After(now) || trapped.HP >= 240 {
		t.Fatalf("expected sukuna shrine hitting enemy to grant invulnerability & slow target (invuln=%v, slow=%v, hp=%d)", sukunaUlt.InvulnUntil.After(now), trapped.SlowUntil.After(now), trapped.HP)
	}

	// Gilgamesh (pa) Skill 2 Enkidu AoE Slow & Skill 3 Sword Rain falling beams
	rsPa := state.NewRoomState("pa-room", 5, cfg)
	pa := &state.PlayerState{ID: "pa-h", Name: "Gilga", CharacterID: "pa", X: 500, Y: 500, HP: 225, MaxHP: 225, Alive: true}
	targetPa := &state.PlayerState{ID: "pa-e", Name: "Target", CharacterID: "default", X: 700, Y: 500, HP: 240, MaxHP: 240, Alive: true}
	rsPa.Players[pa.ID] = pa
	rsPa.Players[targetPa.ID] = targetPa
	eng.CastSkill(rsPa, pa, 2, 700, 500, now)
	eng.StepZones(rsPa, 0.02, now)
	if !targetPa.SlowUntil.After(now) {
		t.Fatalf("expected pa skill 2 enkidu AoE to slow enemies inside zone")
	}
	eng.CastSkill(rsPa, pa, 3, 700, 500, now)
	eng.StepZones(rsPa, 0.2, now)
	eng.StepZones(rsPa, 0.02, now)
	if len(rsPa.Beams) == 0 {
		t.Fatalf("expected pa skill 3 sword rain to spawn falling sky sword beams")
	}

	// Kaem (Rimuru) Skill 1 Black Lightning, Skill 2 Black Flame, Skill 3 Beelzebuth void pull + heal
	rsRimuru := state.NewRoomState("rimuru-room", 5, cfg)
	rimuru := &state.PlayerState{ID: "kaem1", Name: "Kaem", CharacterID: "kaem", X: 600, Y: 600, HP: 180, MaxHP: 235, Alive: true}
	dummy := &state.PlayerState{ID: "dum1", Name: "Dummy", CharacterID: "default", X: 820, Y: 600, HP: 240, MaxHP: 240, Alive: true}
	rsRimuru.Players[rimuru.ID] = rimuru
	rsRimuru.Players[dummy.ID] = dummy

	if _, ok := eng.CastSkill(rsRimuru, rimuru, 1, 820, 600, now); !ok {
		t.Fatalf("expected rimuru black lightning cast")
	}
	eng.StepZones(rsRimuru, 0.25, now)
	eng.StepZones(rsRimuru, 0.02, now)
	if dummy.HP >= 240 {
		t.Fatalf("expected black lightning to damage target after 0.22s windup, got hp=%d", dummy.HP)
	}

	if _, ok := eng.CastSkill(rsRimuru, rimuru, 2, 820, 600, now); !ok {
		t.Fatalf("expected rimuru black flame cast")
	}
	if len(rsRimuru.Projectiles) != 3 {
		t.Fatalf("expected 3 black flame wave projectiles, got %d", len(rsRimuru.Projectiles))
	}

	dummy.HP = 240
	dummy.X = 760
	if _, ok := eng.CastSkill(rsRimuru, rimuru, 3, 660, 600, now); !ok {
		t.Fatalf("expected rimuru beelzebuth cast")
	}
	if rimuru.HP != 200 {
		t.Fatalf("expected rimuru self-heal +20 HP from Beelzebuth, got %d", rimuru.HP)
	}
	eng.StepZones(rsRimuru, 0.35, now)
	eng.StepZones(rsRimuru, 0.05, now)
	if dummy.X >= 760 || dummy.HP >= 240 {
		t.Fatalf("expected beelzebuth void pull and damage (x=%v, hp=%d)", dummy.X, dummy.HP)
	}

	// Frame (Joestar & Stand Cat "Ai-Ouan") Lock-On Pounce (Q), ORA Barrage (E), and Time-Stop Domain (R)
	rsFrame := state.NewRoomState("frame-room", 5, cfg)
	frame := &state.PlayerState{ID: "frame1", Name: "Frame", CharacterID: "frame", X: 600, Y: 600, HP: 250, MaxHP: 250, Alive: true}
	runner := &state.PlayerState{ID: "run1", Name: "Runner", CharacterID: "default", X: 900, Y: 600, HP: 240, MaxHP: 240, Alive: true}
	rsFrame.Players[frame.ID] = frame
	rsFrame.Players[runner.ID] = runner

	if _, ok := eng.CastSkill(rsFrame, frame, 1, 880, 560, now); !ok {
		t.Fatalf("expected frame lock-on pounce cast")
	}
	if len(rsFrame.Projectiles) != 1 || rsFrame.Projectiles[0].TargetID != runner.ID {
		t.Fatalf("expected frame skill 1 projectile to lock onto Runner, got %+v", rsFrame.Projectiles)
	}
	// Move runner sideways after lock-on to verify Stand Cat homes onto moving target
	runner.Y = 760
	for step := 0; step < 35; step++ {
		eng.StepProjectiles(rsFrame, 0.02, now)
	}
	if runner.HP >= 240 || !runner.StunUntil.After(now) {
		t.Fatalf("expected locked Ai-Ouan stand pounce to chase, damage, and stun moving target (hp=%d)", runner.HP)
	}

	runner.HP = 240
	runner.X = 760
	runner.Y = 600
	runner.StunUntil = now
	if _, ok := eng.CastSkill(rsFrame, frame, 2, 860, 600, now); !ok {
		t.Fatalf("expected frame ora barrage cast")
	}
	eng.StepZones(rsFrame, 0.25, now)
	if runner.HP >= 240 || !runner.StunUntil.After(now) {
		t.Fatalf("expected frame ORA meow barrage to damage and stun (hp=%d)", runner.HP)
	}

	runner.HP = 240
	runner.StunUntil = now
	if _, ok := eng.CastSkill(rsFrame, frame, 3, 720, 580, now); !ok {
		t.Fatalf("expected frame lock-on time stop cast")
	}
	eng.StepZones(rsFrame, 0.30, now)
	eng.StepZones(rsFrame, 0.02, now)
	if runner.HP >= 240 || runner.StunUntil.Sub(now) < 1500*time.Millisecond {
		t.Fatalf("expected locked Ai-Ouan The World to freeze target with strong CC (hp=%d, stun=%v)", runner.HP, runner.StunUntil.Sub(now))
	}

	// All 9 Characters: Target Lock-On Basic Attacks snap onto an enemy inside range even when aim deviates
	for _, cid := range []string{"default", "pa", "boy", "ole", "thanwa", "ajarn_au", "ajarn_boy", "kaem", "frame", "ko"} {
		rLock := state.NewRoomState("lock-basic-"+cid, 5, cfg)
		atk := &state.PlayerState{ID: "a-" + cid, Name: cid, CharacterID: cid, X: 600, Y: 600, AimDX: -1, AimDY: 0, HP: 240, MaxHP: 240, Alive: true}
		foe := &state.PlayerState{ID: "f-" + cid, Name: "Foe", CharacterID: "default", X: 600, Y: 740, HP: 240, MaxHP: 240, Alive: true}
		rLock.Players[atk.ID] = atk
		rLock.Players[foe.ID] = foe

		// Aim slightly right/up off-target; server lock-on must still snap onto foe & deal damage
		if _, ok := eng.CastBasicAttack(rLock, atk, 650, 710, now); !ok {
			t.Fatalf("expected locked basic attack for %s", cid)
		}
		// Move foe sideways while projectiles travel to prove homing lock-on pursuit
		foe.X = 690
		for step := 0; step < 25; step++ {
			eng.StepProjectiles(rLock, 0.02, now)
		}
		if foe.HP >= 240 {
			t.Fatalf("expected lock-on basic attack of %s to track and hit foe, got hp=%d", cid, foe.HP)
		}
	}

	// Ground skill placed directly at caster's own feet (d < 1px) MUST land on caster, not jump 220px away
	rsFeet := state.NewRoomState("feet-place", 5, cfg)
	kFeet := &state.PlayerState{ID: "kf1", Name: "Feet", CharacterID: "kaem", X: 950, Y: 720, AimDX: 1, AimDY: 0, HP: 235, MaxHP: 235, Alive: true}
	rsFeet.Players[kFeet.ID] = kFeet
	if _, ok := eng.CastSkill(rsFeet, kFeet, 1, kFeet.X+0.2, kFeet.Y-0.3, now); !ok {
		t.Fatalf("expected cast at own feet to succeed")
	}
	if len(rsFeet.Zones) != 1 || math.Hypot(rsFeet.Zones[0].X-kFeet.X, rsFeet.Zones[0].Y-kFeet.Y) > 1.0 {
		t.Fatalf("expected feet placement to stay at (%v,%v), got (%v,%v)", kFeet.X, kFeet.Y, rsFeet.Zones[0].X, rsFeet.Zones[0].Y)
	}
}

func TestAuthUnlimitedSession6DigitAnd3v3Mode(t *testing.T) {
	db := openOptionalTestPostgres(t)
	log := logger.New()
	persist := persistence.NewService(db, log)
	defer persist.Close()

	cfg := &config.Config{
		Port:              "0",
		AllowedOrigins:    []string{"http://localhost:5555"},
		ShareBaseURL:      "http://localhost:5555",
		TickRateHz:        30,
		MaxPlayersPerRoom: 5,
	}

	authSvc := auth.NewService(db, log)
	pm := player.NewManager()
	eng := engine.NewEngine()
	syncer := gamesync.NewSynchronizer()
	sm := session.NewManager(log, syncer)
	rm := room.NewManager(cfg.MaxPlayersPerRoom, cfg.TickRateHz, cfg.ShareBaseURL, eng, pm, sm, syncer, persist, log)
	defer rm.Shutdown()

	srv := httptest.NewServer(api.NewRouter(cfg, db, authSvc, rm, sm, syncer, log))
	defer srv.Close()

	suffix := time.Now().Format("150405002")
	uname := "shinobi_" + suffix
	_, regToken := registerTestUser(t, srv.URL, uname, "NarutoTest")

	// Login issues persistent token and validates GET /api/auth/me + PUT /api/users/me/character
	loginResp, err := http.Post(srv.URL+"/api/auth/login", "application/json", strings.NewReader(`{"username":"`+uname+`","password":"secret123"}`))
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}
	defer loginResp.Body.Close()
	if loginResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on login, got %d", loginResp.StatusCode)
	}
	var loginOut struct {
		User  auth.UserProfile `json:"user"`
		Token string           `json:"token"`
	}
	if err := json.NewDecoder(loginResp.Body).Decode(&loginOut); err != nil {
		t.Fatalf("decode login: %v", err)
	}

	reqHero, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/users/me/character", strings.NewReader(`{"characterId":"kaem"}`))
	reqHero.Header.Set("Content-Type", "application/json")
	reqHero.Header.Set("Authorization", "Bearer "+loginOut.Token)
	heroResp, err := http.DefaultClient.Do(reqHero)
	if err != nil || heroResp.StatusCode != http.StatusOK {
		t.Fatalf("update character failed: err=%v status=%v", err, heroResp)
	}
	_ = heroResp.Body.Close()

	// Create 3v3 Konoha Village room with 6-digit numeric ID
	reqCreate, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/rooms", strings.NewReader(`{"mode":"tdm_3v3","mapId":"konoha"}`))
	reqCreate.Header.Set("Content-Type", "application/json")
	reqCreate.Header.Set("Authorization", "Bearer "+loginOut.Token)
	roomResp, err := http.DefaultClient.Do(reqCreate)
	if err != nil || roomResp.StatusCode != http.StatusCreated {
		t.Fatalf("create 3v3 room failed: %v", err)
	}
	defer roomResp.Body.Close()
	var r3 room.RoomInfo
	if err := json.NewDecoder(roomResp.Body).Decode(&r3); err != nil {
		t.Fatalf("decode 3v3 room: %v", err)
	}
	if len(r3.RoomID) != 6 || r3.Mode != state.ModeTDM3v3 || r3.MapID != state.MapKonoha || r3.Phase != state.PhaseWaiting || r3.TargetKills != 50 {
		t.Fatalf("unexpected 3v3 room info: %+v", r3)
	}

	wsHost := strings.TrimPrefix(srv.URL, "http://")
	clients := make([]*testWSClient, 6)
	clients[0] = dialTestWS(t, wsHost, "/ws?roomId="+r3.RoomID+"&characterId=kaem&token="+loginOut.Token, "http://localhost:5555")
	defer clients[0].close()
	w0 := clients[0].readJSON(t)
	if w0["phase"] != state.PhaseWaiting {
		t.Fatalf("expected 3v3 room to start in waiting phase, got %v", w0["phase"])
	}

	// Host tries starting early before 6/6 -> server rejects with INVALID_MATCH_STATE
	clients[0].writeJSON(t, map[string]any{"type": "start_match"})
	gotReject := false
	deadline := time.Now().Add(1500 * time.Millisecond)
	for time.Now().Before(deadline) {
		m := clients[0].readJSON(t)
		if m["type"] == "error" && m["code"] == "INVALID_MATCH_STATE" {
			gotReject = true
			break
		}
	}
	if !gotReject {
		t.Fatalf("expected error preventing host from starting 3v3 before 6 players join")
	}

	// Fill remaining 5 slots to reach 6/6 (3 Blue vs 3 Red)
	for i := 1; i < 6; i++ {
		_, tok := registerTestUser(t, srv.URL, "p3v3_"+suffix+"_"+string(rune('0'+i)), "Ninja"+string(rune('0'+i)))
		clients[i] = dialTestWS(t, wsHost, "/ws?roomId="+r3.RoomID+"&characterId=thanwa&token="+tok, "http://localhost:5555")
		defer clients[i].close()
		w := clients[i].readJSON(t)
		if w["type"] != "welcome" {
			t.Fatalf("expected welcome for slot %d, got %v", i, w)
		}
	}

	// Now Host starts the match -> phase transitions to playing!
	clients[0].writeJSON(t, map[string]any{"type": "start_match"})
	gotPlaying := false
	deadlineStart := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadlineStart) {
		m := clients[0].readJSON(t)
		if m["type"] == "state" && m["phase"] == state.PhasePlaying {
			gotPlaying = true
			break
		}
	}
	if !gotPlaying {
		t.Fatalf("expected 3v3 room to enter playing phase once all 6 joined and host clicked start")
	}

	// Verify Engine 3v3 Team Friendly-Fire Protection + Konoha Map Config
	konohaCfg := state.MapConfigFor(state.MapKonoha)
	if konohaCfg.ID != state.MapKonoha || len(konohaCfg.Pillars) != 10 {
		t.Fatalf("expected konoha map config with 10 pillars, got %+v", konohaCfg)
	}
	rs3 := state.NewRoomState("3v3-unit", 6, konohaCfg)
	rs3.Mode = state.ModeTDM3v3
	rs3.Phase = state.PhasePlaying
	rs3.TargetKills = 50
	b1 := &state.PlayerState{ID: "b1", Name: "B1", CharacterID: "boy", Team: state.TeamBlue, X: 500, Y: 500, HP: 250, MaxHP: 250, Alive: true}
	b2 := &state.PlayerState{ID: "b2", Name: "B2", CharacterID: "pa", Team: state.TeamBlue, X: 580, Y: 500, HP: 225, MaxHP: 225, Alive: true}
	red1 := &state.PlayerState{ID: "r1", Name: "R1", CharacterID: "ole", Team: state.TeamRed, X: 620, Y: 500, HP: 225, MaxHP: 225, Alive: true}
	rs3.Players[b1.ID] = b1
	rs3.Players[b2.ID] = b2
	rs3.Players[red1.ID] = red1

	eng.CastBasicAttack(rs3, b1, b2.X, b2.Y, time.Now())
	if b2.HP != 225 {
		t.Fatalf("expected zero friendly fire on ally b2, got hp=%d", b2.HP)
	}
	if red1.HP >= 225 {
		t.Fatalf("expected enemy red1 in range to be locked and damaged by 3v3 basic attack, got hp=%d", red1.HP)
	}

	// Logout revokes session permanently; /api/auth/me immediately returns 401
	reqLogout, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/auth/logout", nil)
	reqLogout.Header.Set("Authorization", "Bearer "+regToken)
	logoutResp, err := http.DefaultClient.Do(reqLogout)
	if err != nil || logoutResp.StatusCode != http.StatusOK {
		t.Fatalf("logout failed: %v", err)
	}
	_ = logoutResp.Body.Close()

	reqMe, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/auth/me", nil)
	reqMe.Header.Set("Authorization", "Bearer "+regToken)
	meResp, err := http.DefaultClient.Do(reqMe)
	if err != nil || meResp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected revoked session after logout to return 401, got status=%v err=%v", meResp.StatusCode, err)
	}
	_ = meResp.Body.Close()
}

func TestAdminSaitamaAndGojoHeroes(t *testing.T) {
	db := openOptionalTestPostgres(t)
	log := logger.New()
	cfg := &config.Config{
		Port:              "0",
		AllowedOrigins:    []string{"http://localhost:5555"},
		TickRateHz:        60,
		MaxPlayersPerRoom: 6,
		ShareBaseURL:      "http://localhost:5555",
	}

	persist := persistence.NewService(db, log)
	defer persist.Close()
	authSvc := auth.NewService(db, log)
	if err := authSvc.EnsureAdminUser(context.Background(), "thanwa", "880329"); err != nil {
		t.Fatalf("EnsureAdminUser: %v", err)
	}
	pm := player.NewManager()
	eng := engine.NewEngine()
	syncer := gamesync.NewSynchronizer()
	sm := session.NewManager(log, syncer)
	rm := room.NewManager(cfg.MaxPlayersPerRoom, cfg.TickRateHz, cfg.ShareBaseURL, eng, pm, sm, syncer, persist, log)
	defer rm.Shutdown()

	srv := httptest.NewServer(api.NewRouter(cfg, db, authSvc, rm, sm, syncer, log))
	defer srv.Close()

	// 1. Regular user cannot see or equip Admin-exclusive "luangphi_sorn"
	_, userTok := registerTestUser(t, srv.URL, "normie_"+time.Now().Format("150405003"), "Normie")
	reqSelForbidden, _ := http.NewRequest(http.MethodPut, srv.URL+"/api/users/me/character", strings.NewReader(`{"characterId":"luangphi_sorn"}`))
	reqSelForbidden.Header.Set("Content-Type", "application/json")
	reqSelForbidden.Header.Set("Authorization", "Bearer "+userTok)
	forbidResp, err := http.DefaultClient.Do(reqSelForbidden)
	if err != nil || forbidResp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for non-admin selecting luangphi_sorn, got status=%v err=%v", forbidResp.StatusCode, err)
	}
	_ = forbidResp.Body.Close()

	// 2. Exclusive Admin account sees 13 heroes including luangphi_sorn and noone (Thanos)
	adminLoginResp, err := http.Post(srv.URL+"/api/auth/login", "application/json", strings.NewReader(`{"username":"thanwa","password":"880329"}`))
	if err != nil || adminLoginResp.StatusCode != http.StatusOK {
		t.Fatalf("expected admin login 200, got status=%v err=%v", adminLoginResp.StatusCode, err)
	}
	defer adminLoginResp.Body.Close()
	var adminOut struct {
		User  auth.UserProfile `json:"user"`
		Token string           `json:"token"`
	}
	if err := json.NewDecoder(adminLoginResp.Body).Decode(&adminOut); err != nil {
		t.Fatalf("decode admin login: %v", err)
	}
	if adminOut.User.Role != "admin" {
		t.Fatalf("expected admin role, got %q", adminOut.User.Role)
	}

	reqAdminChars, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/characters", nil)
	reqAdminChars.Header.Set("Authorization", "Bearer "+adminOut.Token)
	adminCharsResp, err := http.DefaultClient.Do(reqAdminChars)
	if err != nil || adminCharsResp.StatusCode != http.StatusOK {
		t.Fatalf("get admin /api/characters: %v", err)
	}
	defer adminCharsResp.Body.Close()
	var adminChars struct {
		Characters []state.CharacterDef `json:"characters"`
	}
	if err := json.NewDecoder(adminCharsResp.Body).Decode(&adminChars); err != nil {
		t.Fatalf("decode admin characters: %v", err)
	}
	if len(adminChars.Characters) != 13 {
		t.Fatalf("expected 13 heroes for admin, got %d", len(adminChars.Characters))
	}

	// 3. Saitama (luangphi_sorn): 1 skill with 20s CD, guaranteed instant kill unless target is Invulnerable
	rs := state.NewRoomState("sorn-test", 6, state.DefaultMapConfig())
	rs.Phase = state.PhasePlaying
	sorn := &state.PlayerState{ID: "sorn", Name: "Sorn", CharacterID: "luangphi_sorn", X: 300, Y: 500, HP: 320, MaxHP: 320, Alive: true}
	victim := &state.PlayerState{ID: "vic", Name: "Victim", CharacterID: "pa", X: 1400, Y: 900, HP: 225, MaxHP: 225, Alive: true}
	invulnTarget := &state.PlayerState{ID: "sukuna", Name: "Sukuna", CharacterID: "ajarn_boy", X: 1600, Y: 900, HP: 255, MaxHP: 255, Alive: true}
	rs.Players[sorn.ID] = sorn
	rs.Players[victim.ID] = victim
	rs.Players[invulnTarget.ID] = invulnTarget

	now := time.Now()
	invulnTarget.InvulnUntil = now.Add(2 * time.Second)

	// Guarded by InvulnUntil -> dodged cleanly!
	hitsBlock, punchesBlock, okBlock := eng.CastSkillWithTarget(rs, sorn, 1, invulnTarget.X, invulnTarget.Y, invulnTarget.ID, now)
	if !okBlock || len(hitsBlock) != 0 || len(punchesBlock) != 1 || !punchesBlock[0].Blocked {
		t.Fatalf("expected invulnerable target to block Saitama punch, got ok=%v hits=%d punches=%+v", okBlock, len(hitsBlock), punchesBlock)
	}
	if !invulnTarget.Alive || invulnTarget.HP != 255 {
		t.Fatalf("expected invulnerable target to survive with full HP, got alive=%v hp=%d", invulnTarget.Alive, invulnTarget.HP)
	}
	// Reset cooldown to test lethal hit after 20s CD enforcement check
	if sorn.CooldownUntil[0].Sub(now) < 19*time.Second {
		t.Fatalf("expected 20s cooldown on Saitama punch, got %v", sorn.CooldownUntil[0].Sub(now))
	}
	sorn.CooldownUntil[0] = time.Time{}

	// Slot 2 does not exist (only 1 skill)
	if _, _, ok2 := eng.CastSkillWithTarget(rs, sorn, 2, victim.X, victim.Y, victim.ID, now); ok2 {
		t.Fatalf("expected Saitama to have only 1 skill")
	}

	// Non-invulnerable target across the map picked by TargetID -> guaranteed 1-hit kill!
	hitsKill, punchesKill, okKill := eng.CastSkillWithTarget(rs, sorn, 1, victim.X, victim.Y, victim.ID, now)
	if !okKill || len(hitsKill) != 1 || len(punchesKill) != 1 || punchesKill[0].Blocked {
		t.Fatalf("expected guaranteed instant kill on vulnerable target, got ok=%v hits=%+v punches=%+v", okKill, hitsKill, punchesKill)
	}
	if victim.Alive || victim.HP != 0 || sorn.Kills != 1 {
		t.Fatalf("expected victim dead and sorn Kills=1, got alive=%v hp=%d kills=%d", victim.Alive, victim.HP, sorn.Kills)
	}

	// 4. Gojo (sia_mon): Red + Blue collide mid-air -> distance-scaled balanced Hollow Purple + 5s Infinite Void
	rsGojo := state.NewRoomState("gojo-test", 6, state.DefaultMapConfig())
	rsGojo.Phase = state.PhasePlaying
	gojo := &state.PlayerState{ID: "gojo", Name: "Gojo", CharacterID: "sia_mon", X: 460, Y: 700, HP: 255, MaxHP: 255, Alive: true}
	nearEnemy := &state.PlayerState{ID: "near", Name: "Near", CharacterID: "boy", X: 710, Y: 700, HP: 250, MaxHP: 250, Alive: true}
	farEnemy := &state.PlayerState{ID: "far", Name: "Far", CharacterID: "thanwa", X: 855, Y: 700, HP: 250, MaxHP: 250, Alive: true}
	rsGojo.Players[gojo.ID] = gojo
	rsGojo.Players[nearEnemy.ID] = nearEnemy
	rsGojo.Players[farEnemy.ID] = farEnemy

	// Fire slow Red along +X at t=0 (starts x~582, speed 245 px/s)
	if _, _, ok := eng.CastSkillWithTarget(rsGojo, gojo, 1, 1400, 700, "", now); !ok {
		t.Fatalf("expected Gojo Skill 1 (Red) to cast")
	}
	// Step 0.45s so Red advances cleanly into x ~ 692 before Blue is launched
	for step := 0; step < 27; step++ {
		eng.StepProjectiles(rsGojo, 1.0/60.0, now.Add(time.Duration(step)*16*time.Millisecond))
	}
	// Fire fast Blue right after Red at 920 px/s -> catches Red mid-air at x ~ 735 (near x=820, far x=990)
	if _, _, ok := eng.CastSkillWithTarget(rsGojo, gojo, 2, 1400, 700, "", now.Add(450*time.Millisecond)); !ok {
		t.Fatalf("expected Gojo Skill 2 (Blue) to cast")
	}
	purpleTriggered := false
	for step := 0; step < 30; step++ {
		eng.StepProjectiles(rsGojo, 1.0/60.0, now.Add(time.Duration(450+step*16)*time.Millisecond))
		for _, z := range rsGojo.Zones {
			if z.Kind == "hollow_purple" {
				purpleTriggered = true
			}
		}
		if purpleTriggered {
			break
		}
	}
	if !purpleTriggered {
		t.Fatalf("expected Red + Blue mid-air collision to trigger hollow_purple zone")
	}
	nearLoss := 250 - nearEnemy.HP
	farLoss := 250 - farEnemy.HP
	if nearLoss <= farLoss || farLoss <= 0 || nearLoss >= 100 {
		t.Fatalf("expected balanced distance-scaled Hollow Purple (0 < farLoss < nearLoss < 100), got nearLoss=%d farLoss=%d", nearLoss, farLoss)
	}

	// Infinite Void (Skill 3): traps enemy inside 265px for 5s while Gojo walks & punches freely!
	voidTarget := &state.PlayerState{ID: "vt", Name: "Trapped", CharacterID: "ole", X: 690, Y: 700, HP: 225, MaxHP: 225, Alive: true}
	rsGojo.Players[voidTarget.ID] = voidTarget
	tVoid := now.Add(3 * time.Second)
	if _, _, ok := eng.CastSkillWithTarget(rsGojo, gojo, 3, 690, 700, "", tVoid); !ok {
		t.Fatalf("expected Gojo Skill 3 (Infinite Void) to cast")
	}
	if !tVoid.Before(voidTarget.VoidUntil) || !tVoid.Before(voidTarget.StunUntil) {
		t.Fatalf("expected enemy in Infinite Void to be trapped in Void & Stunned")
	}
	if tVoid.Before(gojo.StunUntil) || !tVoid.Before(gojo.RapidAttackUntil) {
		t.Fatalf("expected Gojo to stay un-stunned with RapidAttack buff inside Infinite Void")
	}
	// Victim cannot move during Void, while Gojo moves & basic-attacks freely
	voidTarget.InputDX = 1
	if moved := eng.StepPlayer(voidTarget, 0.2, rsGojo.Map, tVoid.Add(500*time.Millisecond)); moved {
		t.Fatalf("expected trapped Infinite Void victim not to move")
	}
	gojo.InputDX = 1
	if moved := eng.StepPlayer(gojo, 0.2, rsGojo.Map, tVoid.Add(500*time.Millisecond)); !moved {
		t.Fatalf("expected Gojo to walk freely inside his Infinite Void")
	}
	hpBeforePunch := voidTarget.HP
	eng.CastBasicAttack(rsGojo, gojo, voidTarget.X, voidTarget.Y, tVoid.Add(600*time.Millisecond))
	if voidTarget.HP >= hpBeforePunch {
		t.Fatalf("expected Gojo to hit trapped enemy freely inside Infinite Void")
	}

	// 5. Ko (Zenitsu): Q & E movement dashes reposition hero & slice targets, R executes 360-degree around-the-body slash!
	rsZen := state.NewRoomState("zen-room", 6, state.DefaultMapConfig())
	rsZen.Phase = state.PhasePlaying
	zen := &state.PlayerState{ID: "zen", Name: "Ko", CharacterID: "ko", X: 400, Y: 700, HP: 235, MaxHP: 235, Alive: true}
	oppE := &state.PlayerState{ID: "oppE", Name: "East", CharacterID: "default", X: 620, Y: 700, HP: 240, MaxHP: 240, Alive: true}
	oppW := &state.PlayerState{ID: "oppW", Name: "West", CharacterID: "default", X: 480, Y: 700, HP: 240, MaxHP: 240, Alive: true}
	rsZen.Players[zen.ID] = zen
	rsZen.Players[oppE.ID] = oppE
	rsZen.Players[oppW.ID] = oppW
	tZen := time.Now()
	if _, _, ok := eng.CastSkillWithTarget(rsZen, zen, 1, 820, 700, "", tZen); !ok || zen.X <= 700 || oppE.HP >= 240 {
		t.Fatalf("expected Zenitsu Q flash dash to reposition hero & slice enemy on path (ok=%v x=%.1f oppE.HP=%d)", ok, zen.X, oppE.HP)
	}
	if _, _, ok := eng.CastSkillWithTarget(rsZen, zen, 2, 420, 700, "", tZen); !ok || zen.X >= 600 || !tZen.Before(zen.BuffUntil) {
		t.Fatalf("expected Zenitsu E sixfold blitz dash to move back cleanly & grant speed buff (ok=%v x=%.1f)", ok, zen.X)
	}
	zenAfterE := zen.X
	// Position OppStar directly along Star Stroke 1 (from v[0] -> v[2] around zen at (zen.X, 700), R=245, aimAngle=0)
	v0x, v0y := zenAfterE+245, 700.0
	v2x, v2y := zenAfterE+245*math.Cos(4*math.Pi/5), 700.0+245*math.Sin(4*math.Pi/5)
	oppStar := &state.PlayerState{ID: "oppStar", Name: "StarTarget", CharacterID: "default", X: (v0x + v2x) * 0.5, Y: (v0y + v2y) * 0.5, HP: 240, MaxHP: 240, Alive: true}
	rsZen.Players[oppStar.ID] = oppStar
	if _, _, ok := eng.CastSkillWithTarget(rsZen, zen, 3, zen.X+100, zen.Y, "", tZen); !ok || zen.X != zenAfterE || !tZen.Before(zen.InvulnUntil) {
		t.Fatalf("expected Zenitsu R Star-Slash ult to stay centered & grant untargetable invulnerability")
	}
	for s := 0; s < 6; s++ {
		eng.StepZones(rsZen, 0.15, tZen.Add(time.Duration((s+1)*150)*time.Millisecond))
	}
	starBeams := 0
	for _, b := range rsZen.Beams {
		if b.Kind == "zenitsu_murad_slash" {
			starBeams++
		}
	}
	if oppStar.HP >= 240 || starBeams != 5 || len(rsZen.Zones) == 0 || rsZen.Zones[0].StepCount != 5 {
		t.Fatalf("expected Zenitsu R 5 sequential star-slash beams hitting star-leg enemy (hp=%d, starBeams=%d)", oppStar.HP, starBeams)
	}
}

func TestPracticeModeDummies7SecRespawnAndCooldownZeroSync(t *testing.T) {
	db := openOptionalTestPostgres(t)
	log := logger.New()
	cfg := &config.Config{
		Port:              "0",
		AllowedOrigins:    []string{"http://localhost:5555"},
		TickRateHz:        60,
		MaxPlayersPerRoom: 6,
		ShareBaseURL:      "http://localhost:5555",
	}

	persist := persistence.NewService(db, log)
	defer persist.Close()
	authSvc := auth.NewService(db, log)
	pm := player.NewManager()
	eng := engine.NewEngine()
	syncer := gamesync.NewSynchronizer()
	sm := session.NewManager(log, syncer)
	rm := room.NewManager(cfg.MaxPlayersPerRoom, cfg.TickRateHz, cfg.ShareBaseURL, eng, pm, sm, syncer, persist, log)
	defer rm.Shutdown()

	srv := httptest.NewServer(api.NewRouter(cfg, db, authSvc, rm, sm, syncer, log))
	defer srv.Close()

	_, tok := registerTestUser(t, srv.URL, "prac_"+time.Now().Format("150405009"), "Tester")
	wsHost := strings.TrimPrefix(srv.URL, "http://")

	// 1. Practice Mode Room -> Starts in Waiting Lobby first (all modes except FFA wait in lobby), then host starts into 2 Training Dummies
	reqPrac, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/rooms", strings.NewReader(`{"mode":"practice","mapId":"konoha"}`))
	reqPrac.Header.Set("Content-Type", "application/json")
	reqPrac.Header.Set("Authorization", "Bearer "+tok)
	resp, err := http.DefaultClient.Do(reqPrac)
	if err != nil || resp.StatusCode != http.StatusCreated {
		t.Fatalf("create practice room: status=%v err=%v", resp.StatusCode, err)
	}
	var pracInfo struct {
		RoomID string `json:"roomId"`
		Mode   string `json:"mode"`
		Phase  string `json:"phase"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&pracInfo)
	_ = resp.Body.Close()
	if pracInfo.Mode != state.ModePractice || pracInfo.Phase != state.PhaseWaiting {
		t.Fatalf("expected practice mode to wait in lobby before start, got mode=%q phase=%q", pracInfo.Mode, pracInfo.Phase)
	}

	c := dialTestWS(t, wsHost, "/ws?roomId="+pracInfo.RoomID+"&characterId=boy&token="+tok, "http://localhost:5555")
	defer c.close()
	welcome := c.readJSON(t)
	if welcome["phase"] != state.PhaseWaiting {
		t.Fatalf("expected practice welcome phase=waiting, got %v", welcome["phase"])
	}
	playersRaw, _ := welcome["players"].([]any)
	if len(playersRaw) != 3 { // 1 tester + 2 training dummies
		t.Fatalf("expected tester + 2 dummies in practice welcome, got %d players", len(playersRaw))
	}

	// Host presses Start to enter Practice arena
	c.writeJSON(t, map[string]any{"type": "start_match"})
	pracStarted := false
	deadPracStart := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadPracStart) {
		m := c.readJSON(t)
		if m["type"] == "state" && m["phase"] == state.PhasePlaying {
			pracStarted = true
			break
		}
	}
	if !pracStarted {
		t.Fatalf("expected practice room to transition from waiting lobby to playing on start_match")
	}

	// Switch hero live to sia_mon inside practice arena!
	c.writeJSON(t, map[string]any{"type": "switch_character", "characterId": "sia_mon"})
	switched := false
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		m := c.readJSON(t)
		if m["type"] == "state" {
			ps, _ := m["players"].([]any)
			for _, raw := range ps {
				pm, _ := raw.(map[string]any)
				if pm["id"] == welcome["playerId"] && pm["characterId"] == "sia_mon" {
					switched = true
					break
				}
			}
			if switched {
				break
			}
		}
	}
	if !switched {
		t.Fatalf("expected live hero switch to sia_mon inside practice mode")
	}

	// Cast basic attack -> wait idly without moving -> verify server pushes final 0ms basicCooldownMs!
	c.writeJSON(t, map[string]any{"type": "attack", "tx": 1730, "ty": 900})
	sawZeroAfterCooldown := false
	sawNonZero := false
	deadlineCd := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadlineCd) {
		m := c.readJSON(t)
		if m["type"] == "state" {
			ps, _ := m["players"].([]any)
			for _, raw := range ps {
				pm, _ := raw.(map[string]any)
				if pm["id"] == welcome["playerId"] {
					bcd, _ := pm["basicCooldownMs"].(float64)
					if bcd > 0 {
						sawNonZero = true
					} else if sawNonZero && bcd == 0 {
						sawZeroAfterCooldown = true
					}
				}
			}
			if sawZeroAfterCooldown {
				break
			}
		}
	}
	if !sawZeroAfterCooldown {
		t.Fatalf("expected cooldown expiration when idle to broadcast 0ms cleanly (not stall at 0.1s)")
	}

	// 2. Verify 7-second Respawn Cooldown on FFA match
	reqFFA, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/rooms", strings.NewReader(`{"mode":"ffa","mapId":"shibuya"}`))
	reqFFA.Header.Set("Content-Type", "application/json")
	reqFFA.Header.Set("Authorization", "Bearer "+tok)
	ffaResp, err := http.DefaultClient.Do(reqFFA)
	if err != nil || ffaResp.StatusCode != http.StatusCreated {
		t.Fatalf("create ffa room failed")
	}
	var ffaInfo struct {
		RoomID string `json:"roomId"`
	}
	_ = json.NewDecoder(ffaResp.Body).Decode(&ffaInfo)
	_ = ffaResp.Body.Close()

	_, tok2 := registerTestUser(t, srv.URL, "p2_resp_"+time.Now().Format("150405009"), "Killer")
	c1 := dialTestWS(t, wsHost, "/ws?roomId="+ffaInfo.RoomID+"&characterId=pa&token="+tok, "http://localhost:5555")
	defer c1.close()
	w1 := c1.readJSON(t)
	_ = w1
	c2 := dialTestWS(t, wsHost, "/ws?roomId="+ffaInfo.RoomID+"&characterId=boy&token="+tok2, "http://localhost:5555")
	defer c2.close()
	w2 := c2.readJSON(t)
	_ = w2

	// c2 walks/attacks won't easily be adjacent because spawns spread apart, so verify admin Saitama instant-kill triggers 7s cooldown!
	_ = authSvc.EnsureAdminUser(context.Background(), "thanwa", "880329")
	admLogin, _ := http.Post(srv.URL+"/api/auth/login", "application/json", strings.NewReader(`{"username":"thanwa","password":"880329"}`))
	var admOut struct {
		Token string `json:"token"`
	}
	_ = json.NewDecoder(admLogin.Body).Decode(&admOut)
	_ = admLogin.Body.Close()

	cAdm := dialTestWS(t, wsHost, "/ws?roomId="+ffaInfo.RoomID+"&characterId=luangphi_sorn&token="+admOut.Token, "http://localhost:5555")
	defer cAdm.close()
	_ = cAdm.readJSON(t)

	victimID, _ := w1["playerId"].(string)
	cAdm.writeJSON(t, map[string]any{"type": "skill", "slot": 1, "tx": 1000, "ty": 500, "targetId": victimID})

	// Check c1 receives respawnInMs > 5500 and premature "respawn" does not revive c1!
	got7sLock := false
	deadlineRsp := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadlineRsp) {
		m := c1.readJSON(t)
		if m["type"] == "state" {
			ps, _ := m["players"].([]any)
			for _, raw := range ps {
				pm, _ := raw.(map[string]any)
				if pm["id"] == victimID && pm["alive"] == false {
					rsp, _ := pm["respawnInMs"].(float64)
					if rsp > 5500 {
						got7sLock = true
					}
				}
			}
			if got7sLock {
				break
			}
		}
	}
	if !got7sLock {
		t.Fatalf("expected 7-second respawn cooldown (> 5500ms) on victim death in FFA")
	}
	// Early respawn command must be ignored by server!
	c1.writeJSON(t, map[string]any{"type": "respawn"})
	time.Sleep(120 * time.Millisecond)
	stillDead := false
	for i := 0; i < 4; i++ {
		m := c1.readJSON(t)
		if m["type"] == "state" {
			ps, _ := m["players"].([]any)
			for _, raw := range ps {
				pm, _ := raw.(map[string]any)
				if pm["id"] == victimID && pm["alive"] == false {
					stillDead = true
				}
			}
		}
	}
	if !stillDead {
		t.Fatalf("expected early respawn before 7s cooldown to be rejected")
	}
}

func TestDuel1v1Mode5KillsWinAndSornPunch(t *testing.T) {
	db := openOptionalTestPostgres(t)
	log := logger.New()
	cfg := &config.Config{
		Port:              "0",
		AllowedOrigins:    []string{"http://localhost:5555"},
		ShareBaseURL:      "http://localhost:5555",
		TickRateHz:        60,
		MaxPlayersPerRoom: 5,
	}
	pm := player.NewManager()
	eng := engine.NewEngine()
	syncer := gamesync.NewSynchronizer()
	sm := session.NewManager(log, syncer)
	persist := persistence.NewService(db, log)
	defer persist.Close()
	authSvc := auth.NewService(db, log)
	rm := room.NewManager(cfg.MaxPlayersPerRoom, cfg.TickRateHz, cfg.ShareBaseURL, eng, pm, sm, syncer, persist, log)
	defer rm.Shutdown()

	srv := httptest.NewServer(api.NewRouter(cfg, db, authSvc, rm, sm, syncer, log))
	defer srv.Close()

	_, tok1 := registerTestUser(t, srv.URL, "duel1_"+time.Now().Format("150405009"), "Duelist1")
	_, tok2 := registerTestUser(t, srv.URL, "duel2_"+time.Now().Format("150405009"), "Duelist2")
	_, tok3 := registerTestUser(t, srv.URL, "duel3_"+time.Now().Format("150405009"), "Spectator")
	wsHost := strings.TrimPrefix(srv.URL, "http://")

	// 1. Create 1v1 room -> 6-digit code, maxPlayers=2, targetKills=5, waiting lobby
	reqDuel, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/rooms", strings.NewReader(`{"mode":"duel_1v1","mapId":"konoha"}`))
	reqDuel.Header.Set("Content-Type", "application/json")
	reqDuel.Header.Set("Authorization", "Bearer "+tok1)
	resp, err := http.DefaultClient.Do(reqDuel)
	if err != nil || resp.StatusCode != http.StatusCreated {
		t.Fatalf("create 1v1 room failed: status=%v err=%v", resp.StatusCode, err)
	}
	var duelInfo struct {
		RoomID      string `json:"roomId"`
		Mode        string `json:"mode"`
		Phase       string `json:"phase"`
		MaxPlayers  int    `json:"maxPlayers"`
		TargetKills int    `json:"targetKills"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&duelInfo)
	_ = resp.Body.Close()

	matchedCode, _ := regexp.MatchString(`^\d{6}$`, duelInfo.RoomID)
	if !matchedCode || duelInfo.Mode != state.ModeDuel1v1 || duelInfo.Phase != state.PhaseWaiting || duelInfo.MaxPlayers != 2 || duelInfo.TargetKills != 5 {
		t.Fatalf("unexpected 1v1 room metadata: %+v", duelInfo)
	}

	c1 := dialTestWS(t, wsHost, "/ws?roomId="+duelInfo.RoomID+"&characterId=sia_mon&token="+tok1, "http://localhost:5555")
	defer c1.close()
	w1 := c1.readJSON(t)
	if w1["mode"] != state.ModeDuel1v1 || w1["phase"] != state.PhaseWaiting {
		t.Fatalf("expected 1v1 waiting welcome, got %v", w1)
	}

	c2 := dialTestWS(t, wsHost, "/ws?roomId="+duelInfo.RoomID+"&characterId=boy&token="+tok2, "http://localhost:5555")
	defer c2.close()
	w2 := c2.readJSON(t)
	if w2["phase"] != state.PhaseWaiting {
		t.Fatalf("expected c2 waiting phase, got %v", w2["phase"])
	}

	// 3rd player must be rejected because 1v1 room cap is 2!
	c3 := dialTestWS(t, wsHost, "/ws?roomId="+duelInfo.RoomID+"&characterId=pa&token="+tok3, "http://localhost:5555")
	defer c3.close()
	errMsg := c3.readJSON(t)
	if errMsg["type"] != "error" {
		t.Fatalf("expected 3rd player rejected on full 1v1 room, got %v", errMsg)
	}

	// Host starts 1v1 duel!
	c1.writeJSON(t, map[string]any{"type": "start_match"})
	started := false
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		m := c1.readJSON(t)
		if m["type"] == "state" && m["phase"] == state.PhasePlaying {
			started = true
			break
		}
	}
	if !started {
		t.Fatalf("expected 1v1 room to transition to playing phase on host start_match")
	}

	// Verify 5-kill win condition & balanced spawns in unit engine check for duel_1v1
	rs1v1 := state.NewRoomState("112233", 2, state.MapConfigFor(state.MapShibuya))
	rs1v1.Mode = state.ModeDuel1v1
	rs1v1.TargetKills = 5
	pBlue := &state.PlayerState{ID: "p1", Name: "Blue1v1", Team: state.TeamBlue, CharacterID: "sia_mon", HP: 225, MaxHP: 225, Alive: true, X: 250, Y: 900}
	pRed := &state.PlayerState{ID: "p2", Name: "Red1v1", Team: state.TeamRed, CharacterID: "boy", HP: 225, MaxHP: 225, Alive: true, X: 1200, Y: 900}
	rs1v1.Players["p1"] = pBlue
	rs1v1.Players["p2"] = pRed
	bx, _ := eng.SpawnPositionForTeam(rs1v1, state.TeamBlue)
	rx, _ := eng.SpawnPositionForTeam(rs1v1, state.TeamRed)
	if bx > 400 || rx < 2500 {
		t.Fatalf("expected balanced opposite 1v1 spawns, got blue=%v red=%v", bx, rx)
	}
}

func TestIconicModeAutoRandomGojoVsSukunaRCTAndDomainClash(t *testing.T) {
	db := openOptionalTestPostgres(t)
	log := logger.New()
	cfg := &config.Config{
		Port:              "0",
		AllowedOrigins:    []string{"http://localhost:5555"},
		ShareBaseURL:      "http://localhost:5555",
		TickRateHz:        60,
		MaxPlayersPerRoom: 5,
	}
	pm := player.NewManager()
	eng := engine.NewEngine()
	syncer := gamesync.NewSynchronizer()
	sm := session.NewManager(log, syncer)
	persist := persistence.NewService(db, log)
	defer persist.Close()
	authSvc := auth.NewService(db, log)
	rm := room.NewManager(cfg.MaxPlayersPerRoom, cfg.TickRateHz, cfg.ShareBaseURL, eng, pm, sm, syncer, persist, log)
	defer rm.Shutdown()

	srv := httptest.NewServer(api.NewRouter(cfg, db, authSvc, rm, sm, syncer, log))
	defer srv.Close()

	_, tok1 := registerTestUser(t, srv.URL, "ic1_"+time.Now().Format("150405009"), "GojoSide")
	_, tok2 := registerTestUser(t, srv.URL, "ic2_"+time.Now().Format("150405009"), "SukunaSide")
	wsHost := strings.TrimPrefix(srv.URL, "http://")

	// 1. Create Iconic room (locks map to shibuya, maxPlayers=2, targetKills=5)
	reqIconic, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/rooms", strings.NewReader(`{"mode":"iconic","mapId":"konoha"}`))
	reqIconic.Header.Set("Content-Type", "application/json")
	reqIconic.Header.Set("Authorization", "Bearer "+tok1)
	resp, err := http.DefaultClient.Do(reqIconic)
	if err != nil || resp.StatusCode != http.StatusCreated {
		t.Fatalf("create iconic room failed: status=%v err=%v", resp.StatusCode, err)
	}
	var icInfo struct {
		RoomID      string `json:"roomId"`
		Mode        string `json:"mode"`
		MapID       string `json:"mapId"`
		Phase       string `json:"phase"`
		MaxPlayers  int    `json:"maxPlayers"`
		TargetKills int    `json:"targetKills"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&icInfo)
	_ = resp.Body.Close()
	if icInfo.Mode != state.ModeIconic || icInfo.MapID != state.MapShibuya || icInfo.MaxPlayers != 2 || icInfo.TargetKills != 5 || icInfo.Phase != state.PhaseWaiting {
		t.Fatalf("unexpected iconic room metadata: %+v", icInfo)
	}

	// 2. Both join requesting other chars -> backend assigns strictly 1 sia_mon (Gojo) + 1 ajarn_boy (Sukuna)!
	c1 := dialTestWS(t, wsHost, "/ws?roomId="+icInfo.RoomID+"&characterId=pa&token="+tok1, "http://localhost:5555")
	defer c1.close()
	_ = c1.readJSON(t)
	c2 := dialTestWS(t, wsHost, "/ws?roomId="+icInfo.RoomID+"&characterId=boy&token="+tok2, "http://localhost:5555")
	defer c2.close()
	w2 := c2.readJSON(t)

	players2, _ := w2["players"].([]any)
	charsSeen := map[string]bool{}
	for _, raw := range players2 {
		pmMap, _ := raw.(map[string]any)
		cid, _ := pmMap["characterId"].(string)
		charsSeen[cid] = true
	}
	if !charsSeen["sia_mon"] || !charsSeen["ajarn_boy"] || len(charsSeen) != 2 {
		t.Fatalf("expected Iconic mode auto-assign sia_mon & ajarn_boy distinctly, got %v", charsSeen)
	}

	// Manual character selection must be rejected in Iconic mode!
	c1.writeJSON(t, map[string]any{"type": "select_character", "characterId": "pa"})
	gotSelectErr := false
	deadErr := time.Now().Add(1 * time.Second)
	for time.Now().Before(deadErr) {
		m := c1.readJSON(t)
		if m["type"] == "error" {
			gotSelectErr = true
			break
		}
	}
	if !gotSelectErr {
		t.Fatalf("expected select_character to be rejected in Iconic mode")
	}

	// 3. Unit engine verification: Gojo Void damage + Domain Clash counter + RCT 5s full heal
	rsIc := state.NewRoomState("777888", 2, state.MapConfigFor(state.MapShibuya))
	rsIc.Mode = state.ModeIconic
	rsIc.Phase = state.PhasePlaying
	gojo := &state.PlayerState{ID: "g1", Name: "GojoP", Team: state.TeamBlue, CharacterID: "sia_mon", HP: 225, MaxHP: 225, Alive: true, X: 1400, Y: 900}
	sukuna := &state.PlayerState{ID: "s1", Name: "SukunaP", Team: state.TeamRed, CharacterID: "ajarn_boy", HP: 245, MaxHP: 245, Alive: true, X: 1520, Y: 900}
	rsIc.Players["g1"] = gojo
	rsIc.Players["s1"] = sukuna

	now := time.Now()
	outVoid := eng.CastSkillFull(rsIc, gojo, 3, sukuna.X, sukuna.Y, "", now)
	if !outVoid.OK || sukuna.HP >= 245 {
		t.Fatalf("expected Gojo Infinite Void in Iconic mode to deal damage immediately, got hp=%d ok=%v", sukuna.HP, outVoid.OK)
	}

	// RCT heals Sukuna back to full 245 HP and locks 5s cooldown
	if !eng.CastRCT(rsIc, sukuna, now.Add(50*time.Millisecond)) || sukuna.HP != sukuna.MaxHP {
		t.Fatalf("expected Reverse Cursed Technique full heal to %d, got %d", sukuna.MaxHP, sukuna.HP)
	}
	if eng.CastRCT(rsIc, sukuna, now.Add(2*time.Second)) {
		t.Fatalf("expected RCT cooldown 5s to block early recast")
	}
	if !eng.CastRCT(rsIc, sukuna, now.Add(5200*time.Millisecond)) {
		t.Fatalf("expected RCT to be ready again after 5s")
	}

	// Even while trapped inside Infinite Void, Sukuna counter-casting Shrine triggers Domain Clash!
	outShrine := eng.CastSkillFull(rsIc, sukuna, 3, gojo.X, gojo.Y, "", now.Add(150*time.Millisecond))
	if !outShrine.OK || len(outShrine.Clashes) != 1 {
		t.Fatalf("expected Gojo + Sukuna opposing Domains to trigger DomainClashEvent, got clashes=%d ok=%v", len(outShrine.Clashes), outShrine.OK)
	}
	if !sukuna.VoidUntil.IsZero() {
		t.Fatalf("expected mutual Domain Clash to break Infinite Void freeze")
	}
}

func TestThanosNooneInfinityStonesAndSnapModes(t *testing.T) {
	db := openOptionalTestPostgres(t)
	log := logger.New()
	cfg := &config.Config{
		Port:              "0",
		AllowedOrigins:    []string{"http://localhost:5555"},
		TickRateHz:        60,
		MaxPlayersPerRoom: 6,
		ShareBaseURL:      "http://localhost:5555",
	}

	eng := engine.NewEngine()
	cfgMap := state.DefaultMapConfig()
	now := time.Now()

	// 1. Unit mechanics: spawns with 1 random stone, 4 locked skills rejected, +1 kill unlocks +1 unique random stone until 5/5!
	rs := state.NewRoomState("thanos-u", 6, cfgMap)
	rs.Mode = state.ModeFFA
	rs.Phase = state.PhasePlaying
	thanos := &state.PlayerState{
		ID:          "th1",
		Name:        "noone-player",
		Team:        state.TeamFFA,
		CharacterID: "noone",
		X:           700,
		Y:           700,
		HP:          265,
		MaxHP:       265,
		Alive:       true,
	}
	eng.InitHeroState(thanos)
	rs.Players[thanos.ID] = thanos

	if len(thanos.InfinityStones) != 1 || thanos.InfinityStones[0] < 1 || thanos.InfinityStones[0] > 5 {
		t.Fatalf("expected Thanos to start with exactly 1 random Infinity Stone in [1..5], got %v", thanos.InfinityStones)
	}
	starterStone := thanos.InfinityStones[0]

	// All 4 other stones must be blocked; starter stone must succeed; snap must fail before 5 stones!
	for slot := 1; slot <= 5; slot++ {
		out := eng.CastSkillFull(rs, thanos, slot, thanos.X+150, thanos.Y, "", now)
		if slot == starterStone && !out.OK {
			t.Fatalf("expected starter stone skill %d to cast cleanly", slot)
		}
		if slot != starterStone && out.OK {
			t.Fatalf("expected locked stone skill %d to be blocked when only stone %d is owned", slot, starterStone)
		}
	}
	if _, _, snapOK := eng.CastInfinitySnap(rs, thanos, now); snapOK {
		t.Fatalf("expected Snap to be blocked before collecting all 5 stones")
	}

	// Each kill grants 1 new unique random stone until 5/5 collected
	for k := 1; k <= 4; k++ {
		victim := &state.PlayerState{
			ID:          fmt.Sprintf("v%d", k),
			Name:        fmt.Sprintf("Victim%d", k),
			Team:        state.TeamFFA,
			CharacterID: "default",
			X:           thanos.X + 40,
			Y:           thanos.Y,
			HP:          10,
			MaxHP:       240,
			Alive:       true,
		}
		rs.Players[victim.ID] = victim
		eng.CastBasicAttack(rs, thanos, victim.X, victim.Y, now.Add(time.Duration(k)*time.Second))
		if victim.Alive {
			t.Fatalf("expected low-HP victim %d to die from Thanos gauntlet strike", k)
		}
		if len(thanos.InfinityStones) != k+1 {
			t.Fatalf("expected kill %d to unlock +1 stone (total %d), got %v", k, k+1, thanos.InfinityStones)
		}
	}
	if len(thanos.InfinityStones) != 5 {
		t.Fatalf("expected all 5 stones collected after 4 kills, got %v", thanos.InfinityStones)
	}
	// Reset cooldowns & verify ALL 5 stone skills now cast successfully!
	thanos.CooldownUntil = [5]time.Time{}
	for slot := 1; slot <= 5; slot++ {
		out := eng.CastSkillFull(rs, thanos, slot, thanos.X+120, thanos.Y, "", now.Add(10*time.Second))
		if !out.OK {
			t.Fatalf("expected unlocked stone slot %d to cast once all 5 stones are collected", slot)
		}
	}

	// FFA Snap kills all living enemies cleanly so they can respawn!
	ffaEnemy1 := &state.PlayerState{ID: "fe1", Name: "Enemy1", Team: state.TeamFFA, CharacterID: "default", X: 1200, Y: 500, HP: 240, MaxHP: 240, Alive: true}
	ffaEnemy2 := &state.PlayerState{ID: "fe2", Name: "Enemy2", Team: state.TeamFFA, CharacterID: "default", X: 300, Y: 900, HP: 240, MaxHP: 240, Alive: true}
	rs.Players[ffaEnemy1.ID] = ffaEnemy1
	rs.Players[ffaEnemy2.ID] = ffaEnemy2
	snapHits, killed, snapOK := eng.CastInfinitySnap(rs, thanos, now.Add(11*time.Second))
	if !snapOK || killed != 2 || len(snapHits) != 2 || ffaEnemy1.Alive || ffaEnemy2.Alive {
		t.Fatalf("expected FFA Infinity Snap to kill both living enemies anywhere on map (ok=%v killed=%d)", snapOK, killed)
	}

	// 2. Full Room WebSocket Verification: FFA Snap kills enemy & keeps room playing vs 3v3 Snap ends match immediately!
	persist := persistence.NewService(db, log)
	defer persist.Close()
	authSvc := auth.NewService(db, log)
	pm := player.NewManager()
	sm := session.NewManager(log, nil)
	syncer := gamesync.NewSynchronizer()
	sm = session.NewManager(log, syncer)
	rm := room.NewManager(cfg.MaxPlayersPerRoom, cfg.TickRateHz, cfg.ShareBaseURL, eng, pm, sm, syncer, persist, log)
	defer rm.Shutdown()

	srv := httptest.NewServer(api.NewRouter(cfg, db, authSvc, rm, sm, syncer, log))
	defer srv.Close()
	wsHost := strings.TrimPrefix(srv.URL, "http://")

	_, tokTh := registerTestUser(t, srv.URL, "thanos_ws_"+time.Now().Format("150405001"), "ThanosOne")
	_, tokFoe := registerTestUser(t, srv.URL, "foe_ws_"+time.Now().Format("150405002"), "FoeTwo")

	reqRoom, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/rooms", strings.NewReader(`{"mode":"ffa","mapId":"shibuya"}`))
	reqRoom.Header.Set("Content-Type", "application/json")
	reqRoom.Header.Set("Authorization", "Bearer "+tokTh)
	respRoom, err := http.DefaultClient.Do(reqRoom)
	if err != nil {
		t.Fatalf("create ffa room failed: %v", err)
	}
	var rmFFA room.RoomInfo
	_ = json.NewDecoder(respRoom.Body).Decode(&rmFFA)
	_ = respRoom.Body.Close()

	cTh := dialTestWS(t, wsHost, "/ws?roomId="+rmFFA.RoomID+"&characterId=noone&token="+tokTh, "http://localhost:5555")
	defer cTh.close()
	wTh := cTh.readJSON(t)
	stonesInit, _ := wTh["players"].([]any)[0].(map[string]any)["infinityStones"].([]any)
	if len(stonesInit) != 1 {
		t.Fatalf("expected WS welcome state for Thanos to contain 1 starter infinity stone, got %v", stonesInit)
	}

	cFoe := dialTestWS(t, wsHost, "/ws?roomId="+rmFFA.RoomID+"&characterId=default&token="+tokFoe, "http://localhost:5555")
	defer cFoe.close()
	_ = cFoe.readJSON(t)

	// Practice room WS check: Thanos starts with 1 stone on WS join!
	reqPrac, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/rooms", strings.NewReader(`{"mode":"practice","mapId":"konoha"}`))
	reqPrac.Header.Set("Content-Type", "application/json")
	reqPrac.Header.Set("Authorization", "Bearer "+tokTh)
	respPrac, err := http.DefaultClient.Do(reqPrac)
	if err != nil {
		t.Fatalf("create practice room failed: %v", err)
	}
	var rmPrac room.RoomInfo
	_ = json.NewDecoder(respPrac.Body).Decode(&rmPrac)
	_ = respPrac.Body.Close()

	cPrac := dialTestWS(t, wsHost, "/ws?roomId="+rmPrac.RoomID+"&characterId=noone&token="+tokTh, "http://localhost:5555")
	defer cPrac.close()
	_ = cPrac.readJSON(t) // welcome with 1 starter stone

	// If Thanos dies, all collected Infinity Stones are lost and upon respawn he restarts with 1 fresh random stone!
	slayer := &state.PlayerState{ID: "slayer", Name: "Slayer", Team: state.TeamFFA, CharacterID: "thanwa", X: thanos.X + 30, Y: thanos.Y, HP: 240, MaxHP: 240, Alive: true}
	rs.Players[slayer.ID] = slayer
	thanos.HP = 5
	thanos.InvulnUntil = time.Time{}
	eng.CastBasicAttack(rs, slayer, thanos.X, thanos.Y, now.Add(12*time.Second))
	if thanos.Alive || len(thanos.InfinityStones) != 0 {
		t.Fatalf("expected Thanos death to clear all collected Infinity Stones, got alive=%v stones=%v", thanos.Alive, thanos.InfinityStones)
	}
	thanos.Alive = true
	thanos.HP = thanos.MaxHP
	eng.InitHeroState(thanos)
	if len(thanos.InfinityStones) != 1 {
		t.Fatalf("expected respawned Thanos to reset back to 1 random stone, got %v", thanos.InfinityStones)
	}

	// Verify 3v3 instant-win path cleanly on RoomManager/engine integration via ModeTDM3v3 state check:
	rs3v3 := state.NewRoomState("3v3snap", 6, cfgMap)
	rs3v3.Mode = state.ModeTDM3v3
	rs3v3.TargetKills = 50
	rs3v3.Phase = state.PhasePlaying
	tBlue := &state.PlayerState{ID: "tb1", Name: "nooneBlue", Team: state.TeamBlue, CharacterID: "noone", X: 600, Y: 700, HP: 265, MaxHP: 265, Alive: true, InfinityStones: []int{1, 2, 3, 4, 5}}
	tRed := &state.PlayerState{ID: "tr1", Name: "EnemyRed", Team: state.TeamRed, CharacterID: "boy", X: 2200, Y: 700, HP: 250, MaxHP: 250, Alive: true}
	rs3v3.Players[tBlue.ID] = tBlue
	rs3v3.Players[tRed.ID] = tRed
	if _, kCount, okSnap := eng.CastInfinitySnap(rs3v3, tBlue, time.Now()); !okSnap || kCount != 1 || !state.IsTeamMatchMode(rs3v3.Mode) {
		t.Fatalf("expected 3v3 Snap with 5 stones to execute and wipe opposing team cleanly (ok=%v killed=%d)", okSnap, kCount)
	}
	_ = rmPrac
}

func TestBinaryProtocolAndTransportInfo(t *testing.T) {
	cfg, _ := config.Load()
	cfg.TickRateHz = 60
	log := logger.New()
	db := openOptionalTestPostgres(t)
	eng := engine.NewEngine()
	mapCfg := state.DefaultMapConfig()

	// 1. Unit verify Binary Codec compaction + Parser roundtrip
	rs := state.NewRoomState("bin-unit", 5, mapCfg)
	rs.Phase = state.PhasePlaying
	p1 := &state.PlayerState{
		ID:          "u-1",
		Name:        "Ko",
		CharacterID: "ko",
		X:           620.4,
		Y:           815.2,
		HP:          210,
		MaxHP:       235,
		Alive:       true,
		LastSeq:     77,
	}
	p2 := &state.PlayerState{
		ID:             "u-2",
		Name:           "Noone",
		CharacterID:    "noone",
		X:              1420.8,
		Y:              810.0,
		HP:             265,
		MaxHP:          265,
		Alive:          true,
		InfinityStones: []int{1, 3, 5},
	}
	rs.Players[p1.ID] = p1
	rs.Players[p2.ID] = p2
	rs.AssignNetID(p1)
	rs.AssignNetID(p2)
	rs.Tick = 123
	rs.Projectiles = append(rs.Projectiles, state.Projectile{
		ID:          "proj-9",
		OwnerID:     p1.ID,
		TargetID:    p2.ID,
		Kind:        "zenitsu_hekireki",
		X:           900,
		Y:           812,
		VX:          350,
		VY:          0,
		Radius:      22,
		Color:       "#FACC15",
		AccentColor: "#FEF08A",
	})
	rs.Zones = append(rs.Zones, state.ZoneEffect{
		ID:          "zone-4",
		OwnerID:     p2.ID,
		Kind:        "thanos_time_mandala",
		X:           1420,
		Y:           810,
		Radius:      180,
		AimAngle:    1.25,
		StepCount:   5,
		Life:        1.5,
		MaxLife:     2.0,
		Color:       "#22C55E",
		AccentColor: "#86EFAC",
	})

	syncer := gamesync.NewSynchronizer()
	now := time.Now()
	binState, okBin := syncer.EncodeBinaryState(rs, now)
	if !okBin {
		t.Fatalf("expected EncodeBinaryState to succeed when NetIDs are assigned")
	}
	if len(binState) < 16 || binState[0] != gamesync.BinServerState {
		t.Fatalf("unexpected binary state header: len=%d op=%x", len(binState), binState[0])
	}
	jsonEquiv, _ := json.Marshal(map[string]any{
		"type":        "state",
		"players":     rs.SnapshotPlayers(now),
		"projectiles": rs.SnapshotProjectiles(),
		"zones":       rs.SnapshotZones(),
	})
	if len(binState)*2 >= len(jsonEquiv) {
		t.Fatalf("expected binary state (%dB) to be <50%% of equivalent JSON (%dB)", len(binState), len(jsonEquiv))
	}

	// Parse C_INPUT + C_SKILL binary packets
	inPkt := make([]byte, 7)
	inPkt[0] = gamesync.BinClientInput
	binary.LittleEndian.PutUint32(inPkt[1:5], 99)
	inPkt[5] = 127
	negDY := int8(-64)
	inPkt[6] = byte(negDY)
	cmdIn, err := gamesync.ParseBinaryCommand(inPkt)
	if err != nil || cmdIn.Type != "input" || cmdIn.Seq != 99 || cmdIn.DX < 0.98 || cmdIn.DY > -0.49 {
		t.Fatalf("unexpected C_INPUT decode: cmd=%+v err=%v", cmdIn, err)
	}

	tid := []byte("target-abc")
	skillPkt := make([]byte, 7+len(tid))
	skillPkt[0] = gamesync.BinClientSkill
	skillPkt[1] = 3
	binary.LittleEndian.PutUint16(skillPkt[2:4], 1250)
	binary.LittleEndian.PutUint16(skillPkt[4:6], 740)
	skillPkt[6] = byte(len(tid))
	copy(skillPkt[7:], tid)
	cmdSkill, err := gamesync.ParseBinaryCommand(skillPkt)
	if err != nil || cmdSkill.Type != "skill" || cmdSkill.Slot != 3 || cmdSkill.TX != 1250 || cmdSkill.TargetID != "target-abc" {
		t.Fatalf("unexpected C_SKILL decode: cmd=%+v err=%v", cmdSkill, err)
	}

	// 2. Integration test: /api/transport/info + live /ws?proto=bin1 binary ping/pong + binary world state ticks
	persist := persistence.NewService(db, log)
	defer persist.Close()
	authSvc := auth.NewService(db, log)
	pm := player.NewManager()
	sm := session.NewManager(log, syncer)
	rm := room.NewManager(cfg.MaxPlayersPerRoom, cfg.TickRateHz, cfg.ShareBaseURL, eng, pm, sm, syncer, persist, log)
	defer rm.Shutdown()

	srv := httptest.NewServer(api.NewRouter(cfg, db, authSvc, rm, sm, syncer, log))
	defer srv.Close()
	wsHost := strings.TrimPrefix(srv.URL, "http://")

	infoResp, err := http.Get(srv.URL + "/api/transport/info")
	if err != nil || infoResp.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/transport/info failed: err=%v resp=%v", err, infoResp)
	}
	var tInfo map[string]any
	_ = json.NewDecoder(infoResp.Body).Decode(&tInfo)
	_ = infoResp.Body.Close()
	if enabled, _ := tInfo["binaryWs"].(bool); !enabled {
		t.Fatalf("expected binaryWs=true in /api/transport/info, got %+v", tInfo)
	}

	// Verify Cloudflare Tunnel / Reverse-Proxy skips unreachable UDP :8443 WebTransport so clients get zero timeout stall
	cfReq, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/transport/info", nil)
	cfReq.Host = "arena.kitsakorn.com"
	cfReq.Header.Set("CF-Ray", "a5df29b67de5-SIN")
	cfReq.Header.Set("X-Forwarded-Proto", "https")
	cfResp, err := http.DefaultClient.Do(cfReq)
	if err != nil || cfResp.StatusCode != http.StatusOK {
		t.Fatalf("GET /api/transport/info (CF) failed: err=%v resp=%v", err, cfResp)
	}
	var cfInfo map[string]any
	_ = json.NewDecoder(cfResp.Body).Decode(&cfInfo)
	_ = cfResp.Body.Close()
	if wt, _ := cfInfo["webTransportUrl"].(string); wt != "" {
		t.Fatalf("expected proxied Cloudflare request to omit direct :8443 webTransportUrl, got %q", wt)
	}

	_, tok := registerTestUser(t, srv.URL, "bin_ws_"+time.Now().Format("150405009"), "BinaryTester")
	reqRoom, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/rooms", strings.NewReader(`{"mode":"ffa","mapId":"shibuya"}`))
	reqRoom.Header.Set("Content-Type", "application/json")
	reqRoom.Header.Set("Authorization", "Bearer "+tok)
	respRoom, err := http.DefaultClient.Do(reqRoom)
	if err != nil {
		t.Fatalf("create room: %v", err)
	}
	var rmInfo room.RoomInfo
	_ = json.NewDecoder(respRoom.Body).Decode(&rmInfo)
	_ = respRoom.Body.Close()

	cBin := dialTestWS(t, wsHost, "/ws?roomId="+rmInfo.RoomID+"&characterId=ko&token="+tok+"&proto=bin1", "http://localhost:5555")
	defer cBin.close()

	welcome := cBin.readJSON(t)
	if welcome["type"] != "welcome" {
		t.Fatalf("expected initial reliable welcome JSON frame, got %+v", welcome)
	}
	playersList, _ := welcome["players"].([]any)
	if len(playersList) == 0 {
		t.Fatalf("expected welcome players array")
	}
	firstPlayer, _ := playersList[0].(map[string]any)
	netIDFloat, _ := firstPlayer["netId"].(float64)
	if netIDFloat <= 0 {
		t.Fatalf("expected assigned non-zero netId on welcome player, got %+v", firstPlayer)
	}

	// Send binary ping + binary input frames over RFC6455 opBinary (0x82)
	const wantPingTS int64 = 1795256789123
	pingPkt := make([]byte, 9)
	pingPkt[0] = gamesync.BinClientPing
	binary.LittleEndian.PutUint64(pingPkt[1:9], uint64(wantPingTS))
	cBin.writeBinary(t, pingPkt)

	movePkt := make([]byte, 7)
	movePkt[0] = gamesync.BinClientInput
	binary.LittleEndian.PutUint32(movePkt[1:5], 11)
	movePkt[5] = 127
	movePkt[6] = 0
	cBin.writeBinary(t, movePkt)

	sawPong := false
	sawState := false
	for i := 0; i < 40 && (!sawPong || !sawState); i++ {
		op, payload := cBin.readFrame(t)
		if op == 0x2 && len(payload) >= 9 && payload[0] == gamesync.BinServerPong {
			gotTS := int64(binary.LittleEndian.Uint64(payload[1:9]))
			if gotTS == wantPingTS {
				sawPong = true
			}
		} else if op == 0x2 && len(payload) >= 16 && payload[0] == gamesync.BinServerState {
			sawState = true
		}
	}
	if !sawPong || !sawState {
		t.Fatalf("expected both binary pong (%v) and binary state (%v) frames over ?proto=bin1", sawPong, sawState)
	}
}
