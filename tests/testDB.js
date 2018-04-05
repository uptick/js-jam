import 'isomorphic-fetch'
import {expect} from 'code'

import {isRecord} from '../src/utils'

import {schema} from './model-fixture'

// Don't dump stuff to the terminal.
console.debug = () => {}
console.warn = () => {}

describe('DB', function() {
  let data = {
    book: {
      title: 'A nice book',
      pages: 20
    },
    book2: {
      title: 'A second book',
      pages: 30
    }
  }

  describe('create', function() {

    it('adds a diff', function() {
      let db = schema.db()
      db.create2('book', data.book)
      expect(db.getDiffs2().size).to.equal(1)
    })

    describe('translates foreignkey values to IDs', () => {

      it('from instances', () => {
        let db = schema.db()
        let inst = db.createInstance('book', data.book)
        let rec = db.create2('book', {...data.book2, next: inst})
        expect(isRecord(rec.next)).to.be.true()
        expect(rec.next.toJS()).to.equal({_type: 'book', id: inst.id})
      })

    })

  })

  describe('update', function() {

    it('adds a diff', function() {
      let db = schema.db()
      let id = db.create2('book', data.book)
      expect(db.getDiffs2().size).to.equal(1)
      db.update(id, {title: 'Another book'})
      expect(db.getDiffs2().size).to.equal(2)
    })

  })

  describe('remove', function() {

    it('adds a diff', function() {
      let db = schema.db()
      let id = db.create2('book', data.book)
      expect(db.getDiffs2().size).to.equal(1)
      db.remove(id)
      expect(db.getDiffs2().size).to.equal(2)
    })

  })

  describe('commit', function() {
    let db = schema.db()
    let id = db.create2('book', data.book)
    db.update(id, {title: 'Another book'})
    db.commit()

    it('compacts compatible commits', function() {
      expect(db.getDiffs2().size).to.equal(1)
    })

    it('updates tail pointer', function() {
      expect(db.getTailPointer()).to.equal(1)
    })

    describe('multiple times', function() {
      let db2 = db.copy()
      db2.update(id, {pages: 30})
      let id2 = db2.create2('book', data.book)
      db2.update(id2, {title: 'Next book'})
      db2.commit()

      it('compacts compatible commits', function() {
        expect(db2.getDiffs2().size).to.equal(3)
      })

      it('updates tail pointer', function() {
        expect(db2.getTailPointer()).to.equal(3)
      })

    })

  })

})
