# tetick

tetick is a course scheduler which takes course data and constructs possible schedules.

a version of it should be on [beta.tetick.xyz](https://beta.tetick.xyz).

## getting started

`make` should run the scrapers, minify and inline the file into www/index.html.

after getting the data, `make` is not needed during development. index.html in the directory will work.

## features

- uses time intervals instead of table cells
- reasonably fast until ~1M combinations
- <150KB gzipped *with* all course data

## non-features

- won't rate schedules for "lunch" or "block courses together"

see [data_spec.md](https://github.com/duck2/tetick/blob/master/data_spec.md) for interpreting scrapers' output.

## dependencies

* awesomplete from Lea Verou is under MIT license.
* the Go Mono font is under 3-clause BSD license.
* the DejaVu Mono font (from which a few icons are pulled) is under the [Bitstream Vera license](https://dejavu-fonts.github.io/License.html).
* the blue noise texture is from "[Free blue noise textures](http://momentsingraphics.de/BlueNoise.html)" are under CC0.
