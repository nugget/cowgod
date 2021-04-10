package tt

import (
	"github.com/alaingilbert/ttapi"
)

var Bot *ttapi.Bot

func New(auth, userID, roomID string) error {
	Bot = ttapi.NewBot(auth, userID, roomID)

	return nil
}
