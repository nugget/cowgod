LIB=	/usr/local/lib
BIN=	/usr/local/bin
TCLSH=	tclsh8.6

default:	all

all:
	@echo - Building package index 
	@echo "pkg_mkIndex -- ." | $(TCLSH)
	@find . -type f -name "*.tcl" -not -name "pkgIndex.tcl" -not -name "all.tcl" -execdir /bin/sh -c "grep -q {} pkgIndex.tcl || echo ERROR: {} is missing from new pkgIndex.tcl!!" \;

install: all
	@install -o root -g wheel -m 0755 -d $(LIB)/cowgod
	@install -o root -g wheel -m 0644 *.tcl $(LIB)/cowgod

clean:
	@echo - Cleaning $(PWD)
	@rm -f *~
