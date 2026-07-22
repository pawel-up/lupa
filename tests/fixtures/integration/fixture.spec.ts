import { test, html, fixture } from '../../../src/testing/api.js'

test.group('Fixture lifecycle', (group) => {
  let groupFixtureElement: Element | null = null

  group.setup(async () => {
    groupFixtureElement = await fixture(html`<div id="group-level">Group Fixture</div>`)
  })

  test('can access group level fixture', ({ assert }) => {
    assert.exists(groupFixtureElement)
    assert.equal(groupFixtureElement?.id, 'group-level')
    assert.equal(document.getElementById('group-level'), groupFixtureElement)
  })

  test('can create test level fixture', async ({ assert }) => {
    const testFixtureElement = await fixture(html`<div id="test-level">Test Fixture</div>`)
    assert.exists(testFixtureElement)
    assert.equal(testFixtureElement.id, 'test-level')
    assert.equal(document.getElementById('test-level'), testFixtureElement)
    // The group level fixture should also be present
    assert.exists(document.getElementById('group-level'))
  })
})

test.group('Cleanup', () => {
  test('group fixture from previous group should be cleaned up', ({ assert }) => {
    assert.notExists(document.getElementById('group-level'), 'Group fixture should have been removed')
  })
})

test.group('fixture on each test', (group) => {
  let counter = 0
  group.each.setup(async () => {
    await fixture(html`<div id="group-level" class="each-fixture" data-test-id="${counter++}">Group Fixture</div>`)
  })

  test('has own fixture (1)', ({ assert }) => {
    const elm = document.getElementById('group-level')
    assert.exists(elm)
    assert.equal(elm?.getAttribute('data-test-id'), '0')
  })

  test('has only own fixture (2)', ({ assert }) => {
    const all = document.getElementsByClassName('each-fixture')
    assert.lengthOf(all, 1)
    assert.equal(all[0].getAttribute('data-test-id'), '1')
  })
})

test.group('Edge Cases', () => {
  test('can create multiple fixtures in a single test', async ({ assert }) => {
    const f1 = await fixture(html`<div class="multi-fix">1</div>`)
    const f2 = await fixture(html`<div class="multi-fix">2</div>`)

    assert.lengthOf(document.getElementsByClassName('multi-fix'), 2)
    assert.equal(f1.textContent, '1')
    assert.equal(f2.textContent, '2')
  })

  test('can create fixture in test.setup', async () => {
    // We can access the test context here if we use the Test instance, but we can also just use activeTest implicitly
  })
    .setup(async () => {
      await fixture(html`<div id="test-setup-fixture">Setup Fixture</div>`)
    })
    .run(async ({ assert }) => {
      assert.exists(document.getElementById('test-setup-fixture'))
    })

  test('can render string templates natively', async ({ assert }) => {
    const el = await fixture<HTMLDivElement>('<div class="string-template" data-content="hello">String Content</div>')

    assert.equal(el.tagName, 'DIV')
    assert.equal(el.className, 'string-template')
    assert.equal(el.textContent, 'String Content')
    assert.equal(el.getAttribute('data-content'), 'hello')

    const queried = document.getElementsByClassName('string-template')
    assert.lengthOf(queried, 1)
    assert.equal(queried[0], el)
  })
})

test.group('Explicit TestContext fixture property', () => {
  test('can render fixture using explicit TestContext property', async ({ fixture: contextFixture, assert }) => {
    const el = await contextFixture(html`<div id="explicit-context-fixture">Explicit Context Fixture</div>`)
    assert.exists(el)
    assert.equal(el.id, 'explicit-context-fixture')
    assert.equal(document.getElementById('explicit-context-fixture'), el)
  })
})
