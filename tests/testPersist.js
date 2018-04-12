import 'isomorphic-fetch'
import {expect} from 'code'

import {Map} from 'immutable'

import {persistToLocalStorage, rehydrateFromLocalStorage} from '../src/persist'

import {schema} from './model-fixture'

// Don't dump stuff to the terminal.
console.debug = () => {}
console.warn = () => {}

describe('persistToLocalStorage', function() {
  let data = {
    book: {
      title: 'A nice book',
      pages: 20
    }
  }
  let db = schema.db()
  let id = db.create2('book', data.book)
  db.commit()

  it('saves tail if tail does not exist', function() {
    expect(localStorage.getItem('jam|tail')).to.be.null()
    persistToLocalStorage(db)
    expect(localStorage.getItem('jam|tail')).not.to.be.null()
  })

  it('does not save tail if tail already exists', function() {
    expect(localStorage.getItem('jam|tail')).not.to.be.null()
    db.update(id, {'title': 'Another title'})
    db.commit()
    let prev = localStorage.getItem('jam|tail')
    persistToLocalStorage(db)
    expect(localStorage.getItem('jam|tail')).to.be.equal(prev)
  })

  it('saves tail if requested', function() {
    let prev = localStorage.getItem('jam|tail')
    persistToLocalStorage({db, force: true})
    expect(localStorage.getItem('jam|tail')).not.to.be.equal(prev)
  })

  it('updates diffs every time', function() {
    let prev = localStorage.getItem('jam|diffs')
    expect(prev).not.to.be.null()
    db.update(id, {'title': 'Diff 1'})
    db.commit()
    persistToLocalStorage(db)
    expect(localStorage.getItem('jam|diffs')).not.to.be.equal(prev)
  })

})

describe('Persisting and rehydrating', function() {
  let data = {
    book: {
      title: 'A nice book',
      pages: 20
    }
  }
  let db = schema.db()
  db.create2('book', data.book)
  db.create2('book', data.book)
  db.commit()
  db.postCommitDiff({
    data: {
      type: 'book',
      id: 1001
    }
  })

  it('saves and loads the same data', function() {
    localStorage.clear()
    persistToLocalStorage(db)
    let db2 = schema.db()
    rehydrateFromLocalStorage(db2)
    expect(db.equals(db2)).to.be.true()
  })

})
