var child_process = require('child_process');
var execSync = child_process.execSync;
var fs = require('fs-extra');
var path = require('path');
var glob = require('glob');

var Client = require('./client');
var client = new Client();

describe('Volumes', function() {
  this.timeout(5000);

  beforeEach(function(done) {
    this.server = new Server();
    this.server.start(function() {
      done();
    })
  })

  afterEach(function(done) {
    this.server.stop(done);
  })

  describe('volumes', function() {
    it('should create & list volumes', function(done) {
      client.run('volumes', 'create', 'vol1');
      client.run('volumes', 'create', 'vol2');
      client.run('volumes', 'list', function(out) {
        assert.equal(out, "vol1\nvol2\n");
        done();
      })
    })

    it('should reject bad volume names', function(done) {
      client.runWithCode('volumes', 'create', 'qwe&*!@#//qwe:', function(code) {
        assert.equal(code, 1);
        done();
      })
    })

    it('should reject creating a volume twice', function(done) {
      client.run('volumes', 'create', 'hello');
      client.runWithCode('volumes', 'create', 'hello', function(code) {
        assert.equal(code, 1);
        done();
      })
    })

    it('should remove a volume', function(done) {
      client.run('volumes', 'create', 'vol1');
      client.run('volumes', 'destroy', 'vol1');
      client.run('volumes', function(out) {
        assert.equal(out, "");
        done();
      })
    })
  });

  describe('help', function() {
    it('should show help for a command', function(done) {
      client.run('help', 'ls', function(out) {
        assert.match(out, /SLICK-LS/);
        done();
      });
    })

    it('should exit(1) for a non-existent command', function(done) {
      client.runWithCode('help', 'blah', function(code) {
        assert.equal(code, 1);
        done();
      });
    })

    it('should list help for every command', function(done) {
      client.runWithCode('--help', function(code, out, err) {
        var binPath = path.resolve(path.join(__dirname, '../../bin/slick-*'));
        glob(binPath, function(err, files) {
          assert(files.length !== 0, 'no bin files');
          files.forEach(function(file) {
            var cmd = path.basename(file).replace(/-/g, ' ');
            assert.match(out, new RegExp(cmd), 'no help found for '+file);
          })
          done();
        })
      });
    })

    it('should list alphebetically all commands', function(done) {
      client.runWithCode('--help', function(code, out, err) {
        var commands = out.match(/    slick ([^\n]+)/g);
        var sortedCommands = commands.slice().sort();

        assert(commands.length, "commands is empty");
        assert.deepEqual(commands, sortedCommands);
        done()
      });
    })
  })

  describe('with a volume', function() {
    beforeEach(function(done) {
      client.run('volumes', 'create', 'vol1', function(out) {
        done()
      });
    })

    describe('add', function() {
      it('should add a file to the root', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/test-copy');
        client.run('ls', 'vol1:/', function(out) {
          assert.equal(out, 'test-copy\n');
          done();
        });
      })

      it('should sniff the mime-type', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/*.png');
        client.run('ls', '-l', 'vol1:/', function(out) {
          assert.match(out, /image\/png/);
          done();
        });
      })

      it('should do nothing if there is nothing to add', function(done) {
        client.runWithCode('add', 'vol1:/', 'qweqweqwe', function(code) {
          assert.equal(code, 1);
          done();
        });
      })

      it('should add multiple files', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/*');
        client.run('ls', 'vol1:/', function(out) {
          assert.equal(out, '[3].png\nanother-file\ndumb\ntest-copy\ntest-copy2\n');
          client.run('ls', 'vol1:/dumb', function(out) {
            assert.equal(out, 'another.txt\nhowsthat.txt\n');
            done();
          });
        });
      })

      it('should add a specific file with glob-syntax in it', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/[3].png');
        client.run('ls', 'vol1:/', function(out) {
          assert.equal(out, '[3].png\n');
          done();
        });
      })

      it('should not overwrite a file', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/test-copy');
        client.run('add', 'vol1:/', 'test/fixtures/test-copy');
        client.run('ls', 'vol1:/', function(out) {
          assert.equal(out, 'test-copy\ntest-copy.2ecd09\n');
          done();
        })
      })

      it('should add a directory to a specific location', function(done) {
        client.run('add', 'vol1:/test', 'test/fixtures');
        client.run('ls', 'vol1:/', function(out) {
          assert.equal(out, 'test\n');
          client.run('ls', 'vol1:/test', function(out) {
            assert.equal(out, '[3].png\nanother-file\ndumb\ntest-copy\ntest-copy2\n');
            done();
          })
        })
      })

      it('should add a directory to an already existing location', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures');
        client.run('ls', 'vol1:/', function(out) {
          assert.equal(out, 'fixtures\n');
          client.run('ls', 'vol1:/fixtures', function(out) {
            assert.equal(out, '[3].png\nanother-file\ndumb\ntest-copy\ntest-copy2\n');
            done();
          })
        })
      })

      it('should add a file to a specific location', function(done) {
        client.run('add', 'vol1:/test', 'test/fixtures/test-copy');
        client.run('cat', 'vol1:/test', function(out) {
          assert.equal(out, fs.readFileSync('test/fixtures/test-copy').toString('utf8'));
          done();
        })
      })

      it('should add a file to an already existing location', function(done) {
        client.run('mkdir', 'vol1:/test');
        client.run('add', 'vol1:/test', 'test/fixtures/test-copy');
        client.run('cat', 'vol1:/test/test-copy', function(out) {
          assert.equal(out, fs.readFileSync('test/fixtures/test-copy').toString('utf8'));
          done();
        })
      })

      it('should allow adding an entire structure to a specific destination', function(done) {
        client.run('mkdir', 'vol1:/test');
        client.run('add', 'vol1:/test', 'test/fixtures/*');
        client.run('cat', 'vol1:/test/dumb/howsthat.txt', function(out) {
          assert.equal(out, fs.readFileSync('test/fixtures/dumb/howsthat.txt').toString('utf8'));
          done();
        })
      })

      it('should skip adding if told to', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/test-copy');
        client.run('add', 'vol1:/', 'test/fixtures/test-copy', '--conflict', 'skip');
        client.run('ls', 'vol1:/', function(out) {
          assert.equal(out, 'test-copy\n');
          done();
        })
      })

      it('should replace a file if told to', function(done) {
        client.run('add', 'vol1:/test-copy', 'test/fixtures/test-copy');
        client.run('ls', 'vol1:/test-copy', '-l', '-U', function(firstList) {
          setTimeout(function() {
            client.run('add', 'vol1:/test-copy', 'test/fixtures/test-copy2', '-c', 'replace');
            client.run('cat', 'vol1:/test-copy', function(out) {
              assert.equal(out, fs.readFileSync(path.join(__dirname, '../fixtures/test-copy2'), 'utf-8'));
              client.run('ls', 'vol1:/test-copy', '-l', '-U', function(secondList) {
                assert.equal(firstList.match(/[a-f0-9]{6} (...............)/)[1], secondList.match(/[a-f0-9]{6} (...............)/)[1]);
                done();
              })
            })
          }, 1000);
        })
      })


      it("should exit(1) if the volume doesn't exist", function(done) {
        client.runWithCode('add', 'qweqwe:/', 'test/fixtures/test-copy', function(code, out, err) {
          assert.equal(code, 1);
          assert.match(err, /cannot find volume/)
          done();
        })
      })
    })

    describe('list', function() {
      it('should list a file', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/test-copy')
        client.run('ls', 'vol1:/test-copy', function(out) {
          assert.equal(out, "test-copy\n");
          done();
        })
      })

      it('should list a directory', function(done) {
        client.run('mkdir', 'vol1:/test')
        client.run('add', 'vol1:/test', 'test/fixtures/test-copy');
        client.run('ls', 'vol1:/test', function(out) {
          assert.equal(out, "test-copy\n");
          done();
        })
      })

      it('should list a file in long mode', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/test-copy');
        client.run('ls', 'vol1:/', '-l', function(out) {
          assert.match(out, /2ecd09\s+[a-zA-Z]{3} \d{2} \d{2}:\d{2}:\d{2}\s+application\/octet-stream\s+34\s+test-copy/);
          done();
        });
      })

      it('should remove a file', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/test-copy');
        client.run('add', 'vol1:/', 'test/fixtures/test-copy');
        client.run('rm', 'vol1:/test-copy');
        client.run('ls', 'vol1:/', function(out) {
          assert.equal(out, "test-copy.2ecd09\n");
          done();
        })
      })

      it("should exit(1) if the volume doesn't exist", function(done) {
        client.runWithCode('ls', 'qweqwe:/', function(code, out, err) {
          assert.equal(code, 1);
          assert.match(err, /not found/)
          done();
        })
      })
    })

    describe('moving', function() {
      it('should move a file', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/test-copy');
        client.run('mv', 'vol1:/test-copy', 'vol1:/test-copy-2');
        client.run('ls', 'vol1:/', function(out) {
          assert.equal(out, "test-copy-2\n");
          done();
        })
      })

      it('should move a file between volumes', function(done) {
        client.run('volumes', 'create', 'stuffok');
        client.run('add', 'vol1:/', 'test/fixtures/test-copy');
        client.run('mv', 'vol1:/test-copy', 'stuffok:/test-copy-2');
        client.run('ls', 'vol1:/', function(out) {
          assert.equal(out, "");
          client.run('ls', 'stuffok:/', function(out) {
            assert.equal(out, "test-copy-2\n");
            done();
          })
        })
      })

      it('should move a file to a directory', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/test-copy');
        client.run('mkdir', 'vol1:/test');
        client.run('mv', 'vol1:/test-copy', 'vol1:/test');
        client.run('ls', 'vol1:/test', function(out) {
          assert.equal(out, "test-copy\n");
          done();
        })
      })

      it('should move a directory', function(done) {
        client.run('mkdir', 'vol1:/test');
        client.run('mv', 'vol1:/test', 'vol1:/test2');
        client.run('ls', 'vol1:/', function(out) {
          assert.equal(out, "test2\n");
          done();
        })
      })

      it('should move a glob', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/*');
        client.run('mkdir', 'vol1:/test');
        client.run('mv', 'vol1:/test-copy*', 'vol1:/test');
        client.run('ls', 'vol1:/test', function(out) {
          assert.equal(out, "test-copy\ntest-copy2\n");
          done();
        })
      })
    })

    describe("copying", function() {
      it('should copy a file', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/test-copy');
        client.run('cp', 'vol1:/test-copy', 'vol1:/test-copy-2');
        client.run('ls', 'vol1:/', function(out) {
          assert.equal(out, "test-copy\ntest-copy-2\n");
          done();
        })
      })

      it('should copy a file between volumes', function(done) {
        client.run('volumes', 'create', 'stuffok');
        client.run('add', 'vol1:/', 'test/fixtures/test-copy');
        client.run('cp', 'vol1:/test-copy', 'stuffok:/test-copy-2');
        client.run('ls', 'vol1:/', function(out) {
          assert.equal(out, "test-copy\n");
          client.run('ls', 'stuffok:/', function(out) {
            assert.equal(out, "test-copy-2\n");
            done();
          })
        })
      })

      it('should copy a file to a directory', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/test-copy');
        client.run('mkdir', 'vol1:/test');
        client.run('cp', 'vol1:/test-copy', 'vol1:/test');
        client.run('ls', 'vol1:/test', function(out) {
          assert.equal(out, "test-copy\n");
          client.run('ls', 'vol1:/', function(out) {
            assert.equal(out, "test\ntest-copy\n");
            done();
          })
        })
      })

      it('should copy a directory', function(done) {
        client.run('mkdir', 'vol1:/test');
        client.run('cp', 'vol1:/test', 'vol1:/test2');
        client.run('ls', 'vol1:/', function(out) {
          assert.equal(out, "test\ntest2\n");
          done();
        })
      })

      it('should copy a glob', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/*');
        client.run('mkdir', 'vol1:/test');
        client.run('cp', 'vol1:/test-copy*', 'vol1:/test');
        client.run('ls', 'vol1:/test', function(out) {
          assert.equal(out, "test-copy\ntest-copy2\n");
          client.run('ls', 'vol1:/', function(out) {
            assert.equal(out, '[3].png\nanother-file\ndumb\ntest\ntest-copy\ntest-copy2\n');
            done();
          })
        })
      })
    })

    describe('info', function() {
      it('should get info for a folder', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/*');
        client.run('info', 'vol1:/', function(out) {
          assert.match(out, /Entries\s+:\s+5/);
          assert.match(out, /Size\s+:\s+39839/);
          done();
        })
      })
    })

    describe('ops', function() {
      it('should add files in the background', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/*', '-b', function(out) {
          assert.match(out, /id 0/);
          client.run('ops', 'wait', '0', function() {
            done();
          });
        });
      })

      it('should list the ops', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/*')
        client.run('ops', 'list', function(out) {
          assert.match(out, /0\s+completed/);
          done();
        })
      })
    })

    describe('cat', function() {
      it('should output a file', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/test-copy');
        client.run('cat', 'vol1:/test-copy', function(out) {
          assert.equal(out, fs.readFileSync('test/fixtures/test-copy').toString('utf8'));
          done();
        })
      })

      it('should return an error on a folder', function(done) {
        client.runWithCode('cat', 'vol1:/', function(code, out, err) {
          assert.match(err, /invalid target for output/);
          assert.equal(code, 1);
          done();
        })
      })
    })

    describe('fetch', function() {
      beforeEach(function() {
        fs.removeSync('/tmp/client');
        fs.ensureDirSync('/tmp/client');
      })

      it('should fetch a file to a file destination', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/test-copy')
        client.run('fetch', 'vol1:/test-copy', '/tmp/client/a-great-file', function(out) {
          assert.equal(fs.readFileSync('/tmp/client/a-great-file').toString('utf8'), fs.readFileSync('test/fixtures/test-copy').toString('utf8'));
          done();
        });
      })

      it('should fetch a file to a directory destination', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/test-copy')
        client.run('fetch', 'vol1:/test-copy', '/tmp/client', function(out) {
          assert.equal(fs.readFileSync('/tmp/client/test-copy').toString('utf8'), fs.readFileSync('test/fixtures/test-copy').toString('utf8'));
          done();
        });
      })

      it('should fetch a directory to a new directory', function(done) {
        client.run('add', 'vol1:/', 'test/fixtures/*')
        client.run('fetch', 'vol1:/', '/tmp/client/fetch', function(out) {
          var fetchedList = execSync('cd /tmp/client/fetch && find . -type f').toString('utf8').split('\n').sort().join('\n')
          var fixturesList = execSync('cd test/fixtures && find . -type f').toString('utf8').split('\n').sort().join('\n')
          assert.equal(fetchedList, fixturesList);
          done();
        });
      })

      it('should fetch a directory to an existing directory', function(done) {
        execSync("mkdir /tmp/client/fetch-test");
        client.run('add', 'vol1:/', 'test/fixtures/*')
        client.run('fetch', 'vol1:/', '/tmp/client/fetch-test', function(out) {
          var fetchedList = execSync('cd /tmp/client/fetch-test && find . -type f').toString('utf8').split('\n').sort().join('\n')
          var fixturesList = execSync('cd test/fixtures && find . -type f').toString('utf8').split('\n').sort().join('\n')
          assert.equal(fetchedList, fixturesList);
          done();
        });
      })

      it("should exit(1) if the volume doesn't exist", function(done) {
        client.runWithCode('fetch', 'qweqwe:/', '/tmp', function(code, out, err) {
          assert.equal(code, 1);
          assert.match(err, /not found/i) // todo: i just want to use status messages, but express makes this super hard
          done();
        })
      })
    })
  })
});
