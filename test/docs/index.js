var fs = require('fs-extra');
var glob = require('glob');
var path = require('path');
var util = require('util');
var assert = require('assert');
var _ = require('lodash');

var error = function(err) {
  console.trace("HIT ERROR", err);
  process.exit(1);
}

var cliDocsPath = path.join(__dirname, '..', '..', 'docs', 'cli', '*.md');
glob(cliDocsPath, function(err, docs) {
  if (err) return error(err);

  var namedDocs = {};
  docs.forEach(function(doc) {
    var name = path.basename(doc, '.md');
    namedDocs[name] = doc;
  })

  var binPath = path.join(__dirname, '..', '..', 'bin', '*');
  glob(binPath, function(err, bins) {
    if (err) return error(err);

    bins.forEach(function(bin) {
      var name = path.basename(bin).replace(/slick-/, '');
      if (!namedDocs[name]) return error("could not find entry for "+bin+" in "+util.inspect(namedDocs))
    });


    var docNames = _.keys(namedDocs);

    docNames.forEach(function(name) {
      var docPath = namedDocs[name];
      var markdown = fs.readFileSync(docPath, 'utf-8');
      var subcommand = name.indexOf('-') !== -1;
      var expectedName =  subcommand ? 'slick-'+name : name;
      var commandExample = subcommand ? 'slick '+name : name;
      var nameMatcher = new RegExp(expectedName + '\\\(1\\\)');
      assert(markdown.match(nameMatcher), docPath+' does not contain '+nameMatcher);
      assert(markdown.indexOf(commandExample) !== -1, docPath+' does not contain '+commandExample);
    })

    console.log("Lookin' good home cookin'");
  });
})
