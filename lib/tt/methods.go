package tt

import (
	"github.com/sirupsen/logrus"
)

func UnpackVotelog(votelog [][]string) (string, string) {
	if len(votelog) < 1 {
		logrus.WithField("votelog", votelog).Warn("Cannot parse Votelog")
		return "", ""
	}

	if len(votelog[0]) < 2 {
		logrus.WithField("votelog", votelog).Warn("Cannot parse Votelog")
		return "", ""
	}

	userID := votelog[0][0]
	vote := votelog[0][1]

	return userID, vote
}

func Bop() {
	if Bot.CurrentDjID == Me {
		logrus.Debug("Not voting for myself")
		return
	}

	err := Bot.VoteUp()
	if err != nil {
		logrus.WithError(err).Error("Unable to VoteUp")
	}
}

func Lame() {
	if Bot.CurrentDjID == Me {
		logrus.Debug("Not voting for myself")
		return
	}

	err := Bot.VoteDown()
	if err != nil {
		logrus.WithError(err).Error("Unable to VoteDown")
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
