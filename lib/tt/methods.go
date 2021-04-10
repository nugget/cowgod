package tt

import (
	"github.com/sirupsen/logrus"
)

func Bop() {
	err := Bot.Bop()
	if err != nil {
		logrus.WithError(err).Error("Failed to bop")
	}
}

func Say(text string) {
	err := Bot.Speak(text)
	if err != nil {
		logrus.WithError(err).Error("Can't speak")
	}
}

func Skip() {
	err := Bot.StopSong()
	if err != nil {
		logrus.WithError(err).Error("Can't skip")
	}
}
