var fs = require('fs');
var packageJSON = require('../../package.json');

describe('bin', function() {
  it('should have every bin', function() {
    var files = fs.readdirSync(__dirname + '/../../bin');
    files.forEach(function(file) {
      assert.equal(packageJSON.bin[file], 'bin/'+file);
    })
    assert(files.length > 0);
    assert.deepEqual(files, _.keys(packageJSON.bin));
  })
})