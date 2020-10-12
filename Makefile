OUTDIR=./www/

all: $(OUTDIR) $(OUTDIR)/index.html

$(OUTDIR):
	mkdir -p -v $(OUTDIR)

$(OUTDIR)/index.html: main.min.js style.css awesomplete.js awesomplete.css
	grep -v -E "(awesomplete.js|data.js)" index.html | sed "s/main\.js/main.min.js/" > index.html.tmp
	./html-inline.py index.html.tmp > $(OUTDIR)/index.html
	rm index.html.tmp

main.min.js: awesomplete.js data.js main.js
	uglifyjs awesomplete.js data.js main.js --compress --mangle >  main.min.js

data.js: data.json musts.json strip.py
	python3 strip.py

data.json: scrape.py
	python3 scrape.py

musts.json: musts.py
	python3 musts.py

clean:
	rm -f main.min.js $(OUTDIR)/index.html
