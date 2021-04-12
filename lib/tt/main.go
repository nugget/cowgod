package tt

import (
	"github.com/alaingilbert/ttapi"
)

var (
	Bot        *ttapi.Bot
	Me         string
	Users      map[string]string
	Moderators []string
)

func New(auth, userID, roomID string) error {
	Bot = ttapi.NewBot(auth, userID, roomID)
	Me = userID
	Users = make(map[string]string)

	return nil
}
