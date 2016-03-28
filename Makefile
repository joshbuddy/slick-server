CLI_DOCS_SRC := $(wildcard docs/cli/*.md)
CLI_DOCS_DEST := $(CLI_DOCS_SRC:docs/cli/%.md=man/man1/slick-%.man.1)

clean:
	rm -rf man

# Testing tasks
#   test - tests everything, test-browser only runs unit tests in browser
#	 test-node only runs tests in nodejs, test-integration runs integration tests

# test-browser is removed for now
test: test-unit test-integration

test-unit:
	NODE_ENV=test ./node_modules/.bin/mocha -R spec test/helpers/node.js test/unit/*_test.js -g '${TEST}'

test-integration: test-clean
	NODE_ENV=test ./node_modules/.bin/mocha -R spec test/helpers/node.js \
		test/integration/*_test.js -g '${TEST}'

test-clean:
	rm -rf /tmp/slick

test-docs:
	node ./test/docs

docs: $(CLI_DOCS_DEST)

man/man1/slick-%.man.1: docs/cli/%.md
	@[ -d man/man1 ] || mkdir -p man/man1
	./node_modules/.bin/marked-man $^ > $@

