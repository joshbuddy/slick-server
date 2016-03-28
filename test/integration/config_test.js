var fs = require('fs-extra')
var Client = require('./client');
var client = new Client(true);

describe("Config", function() {
  beforeEach(function(done) {
    fs.removeSync('/tmp/client1');
    done()
  })

  describe("with no pre-existing root", function() {
    describe("acd", function() {
      it("should setup without password", function(done) {
        this.timeout(5000)
        client.run('config', '-R', '/tmp/client1');
        client.write(/storage type/, 'acd');
        client.write(/folder name/, 'slick');
        client.writeEnd(/use a password/, 'no');
        client.run('config', '-p', '-R', '/tmp/client1', function(out) {
          assert.match(out, /already been configured/)
          var root = fs.readFileSync('/tmp/client1/root');
          var type = root.slice(14, 16).toString('ascii')
          assert.equal(type, 'sx');
          done();
        });
      })

      it("should setup with a password", function(done) {
        this.timeout(30000)
        client.run('config', '-R', '/tmp/client1');
        client.write(/storage type/, 'acd');
        client.write(/folder name/, 'slick');
        client.write(/use a password/, 'yes');
        client.write(/password/, 'password1');
        client.writeEnd(/confirmPassword/, 'password1');
        client.finish(function() {
          client.run('config', '-p', '-R', '/tmp/client1', function(out) {
            assert.match(out, /already been configured/)
            var root = fs.readFileSync('/tmp/client1/root');
            var type = root.slice(14, 17).toString('ascii')
            assert.equal(type, 'pwx');
            done();
          });
          client.writeEnd(/password/, 'password1');
        })
      })
    })
  })

  describe("with a pre-existing root with a password", function() {
    beforeEach(function(done) {
      this.timeout(30000)
      client.run('config', '-R', '/tmp/client1');
      client.write(/storage type/, 'acd');
      client.write(/folder name/, 'slick');
      client.write(/use a password/, 'yes');
      client.write(/password/, 'password1');
      client.writeEnd(/confirmPassword/, 'password1');
      client.finish(done);
    })

    it("should allow removing a password", function(done) {
      this.timeout(30000)
      client.run('config', '-R', '/tmp/client1');
      client.write(/password/, 'password1');
      client.write(/update your configuration/, 'yes');
      client.write(/storage type/, 'acd');
      client.write(/folder name/, 'slick');
      client.writeEnd(/use a password/, 'no');
      client.run('config', '-p', '-R', '/tmp/client1', function(out) {
        assert.match(out, /already been configured/)
        var root = fs.readFileSync('/tmp/client1/root');
        var type = root.slice(14, 16).toString('ascii')
        assert.equal(type, 'sx');
        done();
      });
    })
  });

  describe("with a pre-existing root without a password", function() {
    beforeEach(function(done) {
      this.timeout(5000)
      client.run('config', '-R', '/tmp/client1');
      client.write(/storage type/, 'acd');
      client.write(/folder name/, 'slick');
      client.writeEnd(/use a password/, 'no');
      client.finish(done);
    })

    it("should allow adding a password", function(done) {
      this.timeout(30000)
      client.run('config', '-R', '/tmp/client1');
      client.write(/update your configuration/, 'yes');
      client.write(/storage type/, 'acd');
      client.write(/folder name/, 'slick');
      client.write(/use a password/, 'yes');
      client.write(/password/, 'password1');
      client.writeEnd(/confirmPassword/, 'password1');
      client.finish(function() {
        client.run('config', '-p', '-R', '/tmp/client1', function(out) {
          assert.match(out, /already been configured/)
          var root = fs.readFileSync('/tmp/client1/root');
          var type = root.slice(14, 17).toString('ascii')
          assert.equal(type, 'pwx');
          done();
        });
        client.writeEnd(/password/, 'password1');
      })
    })
  });
})
