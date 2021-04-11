package tt

import (
	"github.com/alaingilbert/ttapi"
)

var (
	Bot *ttapi.Bot
	Me  string
)

func New(auth, userID, roomID string) error {
	Bot = ttapi.NewBot(auth, userID, roomID)
	Me = userID

	return nil
}
