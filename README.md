# tetick

tetick is a course scheduler which takes course data and constructs possible schedules.

a version of it should be on [tetick.xyz](http://tetick.xyz).

## getting started

`make` should run the scrapers, minify and inline the file into www/index.html.

after getting the data, `make` is not needed during development. index.html in the directory will work.

the code is ~600 lines of annotated, vanilla JS. highly operational core is around 100 lines.
you can start reading from [compute()](https://github.com/libduck2/tetick/blob/master/main.js#L374).

## features

- uses time intervals instead of table cells
- consistent collision checking for user-defined time blocks
- reasonably fast until ~1M combinations
- small- ~70KB gzipped *with* all course data

## non-features

- won't display course data
- won't rate schedules for "lunch" or "block courses together"

see [data_spec.md](https://github.com/libduck2/tetick/blob/master/data_spec.md) for interpreting scrapers' output.
