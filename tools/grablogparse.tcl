#!/usr/bin/env tclsh

proc datefmt {epoch} {
	return [clock format $epoch -format "%Y-%m-%d %H:%M:%S" -gmt 1]
}

proc main {} {
	set fh [open log/plug.tsv]

	array set counts {}

	while {1} {
		incr counts(lines)

		if {[eof $fh]} {
			close $fh
			break
		}

		unset -nocomplain log buf loglist
		set buf [gets $fh]
		set loglist [split $buf "\t"]
		if {[catch {array set log $loglist} err]} {
			incr counts(badlines)
			# puts "BAD $buf"
		} else {
			if {![info exists log(event)]} {
				incr counts(noevent)
				# puts "NOEVENT $buf"
			} else {
				if {$log(event) eq "snag"} {
					# puts $buf
					# puts $loglist
					#parray log
					#puts "-- "
					set dt [datefmt $log(clock)]
					set sql "INSERT INTO grabs (ts,user_id,play_id) SELECT '$dt',u.user_id,play_id FROM plays p LEFT JOIN users u ON (u.uid = '$log(plug_user_id)') WHERE p.start_time <= '$dt' AND u.uid = '$log(plug_user_id)' ORDER BY start_time DESC LIMIT 1;"
					puts $sql
				}
			}
		}
	}

	# parray counts

}

if !$tcl_interactive main
