// Package ws implements a minimal per-restaurant WebSocket broadcast hub for
// the Kitchen Display System. No Redis, no external broker — an in-memory
// map is enough for a single backend instance; revisit with Redis pub/sub
// only once DineFlow actually runs on more than one instance.
package ws

import (
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Dev-friendly default. Restrict this to your real frontend origin
	// before deploying to production.
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Client struct {
	conn *websocket.Conn
	send chan []byte
}

// Hub tracks connected Kitchen Display clients grouped by restaurant_id so a
// broadcast only reaches the tablets for that restaurant.
type Hub struct {
	mu    sync.RWMutex
	rooms map[string]map[*Client]bool
}

func NewHub() *Hub {
	return &Hub{rooms: make(map[string]map[*Client]bool)}
}

func (h *Hub) add(restaurantID string, c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[restaurantID] == nil {
		h.rooms[restaurantID] = make(map[*Client]bool)
	}
	h.rooms[restaurantID][c] = true
}

func (h *Hub) remove(restaurantID string, c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if clients, ok := h.rooms[restaurantID]; ok {
		if _, ok := clients[c]; ok {
			delete(clients, c)
			close(c.send)
		}
		if len(clients) == 0 {
			delete(h.rooms, restaurantID)
		}
	}
}

// Broadcast fans a message out to every client currently connected for a
// restaurant. Locking add/remove/Broadcast on the same mutex is what makes
// this safe: remove() can't close a client's channel while Broadcast is
// mid-iteration over that same room.
func (h *Hub) Broadcast(restaurantID string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.rooms[restaurantID] {
		select {
		case c.send <- message:
		default:
			// Slow/stuck client — skip this message rather than block every
			// other kitchen display. Its readPump will notice the dead
			// connection on its own and clean up.
		}
	}
}

// ServeKitchen upgrades the request to a WebSocket and keeps it registered
// under restaurantID until the connection closes.
func (h *Hub) ServeKitchen(w http.ResponseWriter, r *http.Request, restaurantID string) error {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return err
	}

	client := &Client{conn: conn, send: make(chan []byte, 16)}
	h.add(restaurantID, client)

	go client.writePump()
	go func() {
		client.readPump()
		h.remove(restaurantID, client)
	}()

	return nil
}

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10
)

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// readPump exists to keep gorilla's control-frame handling (pong/close)
// running and to detect disconnects. The Kitchen Display never actually
// needs to send application data to the server in this phase.
func (c *Client) readPump() {
	defer c.conn.Close()
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	for {
		if _, _, err := c.conn.ReadMessage(); err != nil {
			return
		}
	}
}
