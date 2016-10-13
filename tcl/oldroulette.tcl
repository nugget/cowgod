#!/usr/bin/env tclsh

proc scan_line {buf} {
	set buf [string trim $buf]
	set buf [regsub {\tchat_id$} $buf ""]

	array set log [split $buf "\t"]

	if {$log(event) eq "djAdvance"} {
		unset -nocomplain ::play
		array set ::play [array get log]
		incr ::stats(plays)
	}

	if {$log(event) eq "chat" && $log(nickname) eq "cowgod"} {
		if {[regexp {The leader is now} $log(message)]} {
			set ::streak 0
			set ::playlist [list]
			puts "-- new leader $log(message)"
		}

		if {[regexp {LEAD SONG} $log(message)]} {
			unset -nocomplain ::lead
			array set ::lead [array get ::play]
			puts "-- new lead song $::lead(song) $::lead(title)"
		}

		if {[regexp {RICSAS} $log(message)]} {
			set ::streak 0
			set ::playlist [list]
			puts "-- no DJ streak is 0"
		}

		if {[regexp {click} $log(message)]} {
			incr ::streak
			lappend ::playlist $::lead(clock)

			puts "UPDATE plays SET room_mode = 'roulette', shot = FALSE, streak = $::streak WHERE shot IS NULL AND play_id = (SELECT play_id FROM plays WHERE start_time <= '[clock format $::lead(clock) -format "%Y-%m-%d %H:%M:%S" -gmt 1]' ORDER BY start_time DESC LIMIT 1) RETURNING play_id;"
		}

		if {[regexp {has been shot} $log(message)]} {
			incr ::streak
			puts "UPDATE plays SET room_mode = 'roulette', shot = TRUE, streak = $::streak WHERE shot IS NULL AND play_id = (SELECT play_id FROM plays WHERE start_time <= '[clock format $::lead(clock) -format "%Y-%m-%d %H:%M:%S" -gmt 1]' ORDER BY start_time DESC LIMIT 1) RETURNING play_id;"
		}
	}

}

proc main {} {
	set fh [open "log/plug.tsv" "r"]

	while {1} {
		incr ::stats(lines)

		set buf [gets $fh]

		if {[catch {scan_line $buf} err]} {
			puts $err
			puts $buf
		}

		if {[eof $fh]} {
			close $fh
			break
		}
	}

	parray ::stats
}

if !$tcl_interactive main
