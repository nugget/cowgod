package main

import (
	"fmt"
	"os"

	"github.com/alaingilbert/ttapi"
)

func main() {
	auth := os.Getenv("TTAPI_AUTH")
	userID := os.Getenv("TTAPI_USER_ID")
	roomID := os.Getenv("TTAPI_ROOM_ID")
	bot := ttapi.NewBot(auth, userID, roomID)

	bot.OnSpeak(func(evt ttapi.SpeakEvt) {
		if evt.Text == "/hello" {
			_ = bot.Speakf("Hey! How are you @%s ?", evt.Name)
		}
	})

	bot.OnNewSong(func(evt ttapi.NewSongEvt) {
		fmt.Printf("%+v\n", evt)
		err := bot.Bop()
		if err != nil {
			fmt.Println(err)
		}
	})
	bot.Start()
}
