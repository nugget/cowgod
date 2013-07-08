#!/usr/local/bin/tclsh8.6

package require http
package require tls

proc main {} {
	set writepath [file join "." "public_html" "avatars"]
	set start 1100
	set end 5000

	::http::register https 443 ::tls::socket

	for {set i $start} {$i <= $end} {incr i} {
		set notfound 0

		foreach image {fullfront headfront fullback headback} {
			set url "https://s3.amazonaws.com/static.turntable.fm/roommanager_assets/avatars/${i}/${image}.png"
			set url "https://turntable.fm/roommanager_assets/avatars/${i}/${image}.png"
			set filename "[file join $writepath "${image}_[format "%03d" $i].png"]"
			# puts "$url -> $filename"

			if {[file exists $filename]} {
				puts "(ok) $filename [file size $filename]"
			} else {
				if {[string is false -strict $notfound]} {
					set token [::http::geturl $url -binary 1 -keepalive 1]
					set ncode [::http::ncode $token]
					puts "[format "%03d"  $ncode] $url"
					if {$ncode == 200} {
						set fh [open $filename "w"]
						fconfigure $fh -translation binary
						puts $fh [::http::data $token]
						close $fh
						puts "(dl) $filename [file size $filename]"
					} else {
						# puts "(nf) $filename"
						set notfound 1
					}
					::http::cleanup $token
				}
			}
		}
	}
}

if !$tcl_interactive main
