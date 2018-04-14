import 'isomorphic-fetch'
import {expect} from 'code'
import sinon from 'sinon'

import F from '../src/filter'
import {makeId, getDiffType, isRecord} from '../src/utils'

import {schema} from './model-fixture' // TODO: Deprecate
import './silence'
import * as fixture from './fixture'

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

  describe('commitDiff', function() {
    let db = fixture.schema.db()
    let movie = db.create2('movie', {})
    db.commit()
    db.update(movie, {'title': 'Test'})
    db.commit()

    let createStub
    let updateStub

    beforeEach(function() {
      createStub = sinon.stub().resolves('create')
      db.schema.models.get('movie').ops.create = createStub
      updateStub = sinon.stub().resolves('update')
      db.schema.models.get('movie').ops.update = updateStub
    })

    it('returns a promise for creates', async function() {
      let db2 = db.copy()
      expect(await db2.commitDiff()).to.equal('create')
      db2.postCommitDiff({data: {id: 1001}})
      expect(db2.getOutgoingDiffs().size).to.equal(1)
    })

    it('returns a promise for updates', async function() {
      let db2 = db.copy()
      db2.postCommitDiff({data: {id: 1001}})
      expect(await db2.commitDiff()).to.equal('update')
      db2.postCommitDiff({data: {id: 1002}})
      expect(db2.getOutgoingDiffs().size).to.equal(0)
    })

  })

  describe('postCommitDiff', function() {

    describe('for creation', function() {
      let db = fixture.schema.db()
      let movie = db.create2('movie', {})
      let person = db.create2('person', {
        owns: [movie],
        favorite: movie
      })
      db.commit()
      let diff = db.getOutgoingDiffs().get(0)
      let type = getDiffType(diff)
      let id = diff.id[1]
      let nDiffs = db.getOutgoingDiffs().size
      db.postCommitDiff({
        data: {
          type,
          id: 1001
        }
      })

      it('removes the first diff', function() {
        expect(db.getOutgoingDiffs().size).to.equal(nDiffs - 1)
      })

      it('adds an entry to the ID table', function() {
        expect(db.getIDTable(type).size).to.equal(1)
        expect(db.mapID(type, 1001)).to.equal(id)
      })

      describe('maps IDs', function() {

        it('in gets', function() {
          expect(db.get(type, id).id).to.equal(id)
          expect(db.get(type, 1001).id).to.equal(id)
        })

        describe('in filtering', function() {

          it('IDs', function() {
            expect(db.filter(type, {id}).toJS().map(x => x.id)).to.equal([id])
            expect(db.filter(type, {id: 1001}).toJS().map(x => x.id)).to.equal([id])
          })

          it('foreign-keys', function() {
            // TODO: Remove assumption that the first diff is a movie.
            let p
            p = db.filter('person', {favorite: makeId('movie', id)})
            expect(person.id).to.equal(p.first().id)
            p = db.filter('person', {favorite: makeId('movie', 1001)})
            expect(person.id).to.equal(p.first().id)
          })

          it('many-to-manys', function() {
            let p
            p = db.filter('person', F.in('owns', makeId('movie', id)))
            expect(person.id).to.equal(p.first().id)
            p = db.filter('person', F.in('owns', makeId('movie', 1001)))
            expect(person.id).to.equal(p.first().id)
          })

        })

        describe('in loads from JSON-API', function() {

          it('with mapped ID', function() {
            let db2 = db.copy()
            db2.loadJsonApi({
              data: {
                type: 'movie',
                id: 1001,
                attributes: {
                  title: 'Testing'
                }
              }
            })
            let m = db2.get(makeId('movie', id))
            expect(m.title).to.equal('Testing')
          })

          it('with foreign-keys', function() {
            let db2 = db.copy()
            db2.loadJsonApi({
              data: {
                type: 'person',
                id: 2001,
                relationships: {
                  favorite: {
                    data: {
                      type: 'movie',
                      id: 1001
                    }
                  }
                }
              }
            })
            let p = db2.get('person', 2001)
            expect(p.favorite.id).to.equal(id)
          })

          it('with many-to-manys', function() {
            let db2 = db.copy()
            db2.loadJsonApi({
              data: {
                type: 'person',
                id: 2001,
                relationships: {
                  owns: {
                    data: [
                      {
                        type: 'movie',
                        id: 1001
                      }
                    ]
                  }
                }
              }
            })
            let p = db2.get('person', 2001)
            expect(p.owns.first().id).to.equal(id)
          })

        })

        describe('in pushes to remote', function() {
          let createStub
          let addStub

          beforeEach(function() {
            createStub = sinon.stub()
            db.schema.models.get('person').ops.create = createStub
            addStub = sinon.stub()
            db.schema.models.get('person').ops.ownsAdd = addStub
          })

          afterEach(() => {
            // db.schema.models.get('person').ops.create = undefined
          })

          it('with mapped ID', function() {
            // TODO
          })

          it('with foreign-keys', function() {
            let db2 = db.copy()
            db2.commitDiff()
            expect(createStub.getCall(0).args[0].data.relationships.favorite.data.id).to.equal(1001)
          })

          it('with many-to-many adds', function() {
            let db2 = db.copy()
            db2.commitDiff()
            db2.postCommitDiff({data: {}})
            db2.commitDiff()
            expect(addStub.getCall(0).args[0]).to.equal(person.id)
            expect(addStub.getCall(0).args[1].data[0].id).to.equal(1001)
          })

          it('with many-to-many removes', function() {
            // TODO
          })

        })

        describe('in creates', function() {

          it('with foreign-keys', function() {
            let db2 = db.copy()
            let p
            p = db2.create2('person', {favorite: makeId('movie', id)})
            expect(p.favorite.id).to.equal(id)
            p = db2.create2('person', {favorite: makeId('movie', 1001)})
            expect(p.favorite.id).to.equal(id)
          })

          it('with many-to-manys', function() {
            let db2 = db.copy()
            let p
            p = db2.create2('person', {owns: [makeId('movie', id)]})
            expect(p.owns.first().id).to.equal(id)
            p = db2.create2('person', {owns: [makeId('movie', 1001)]})
            expect(p.owns.first().id).to.equal(id)
          })

        })

        describe('in updates', function() {

          it('with mapped ID', function() {
            let db2 = db.copy()
            db2.update(makeId('movie', 1001), {title: 'Testing'})
            let m = db2.get(makeId('movie', id))
            expect(m.title).to.equal('Testing')
          })

          it('with foreign-keys', function() {
            let db2 = db.copy()
            let p
            p = db2.create2('person', {favorite: makeId('movie', id)})
            p = db2.update(p, {favorite: makeId('movie', 1001)})
            expect(p.favorite.id).to.equal(id)
          })

          it('with many-to-manys', function() {
            let db2 = db.copy()
            let p
            p = db2.create2('person', {owns: [makeId('movie', id)]})
            p = db2.update(p, {owns: [makeId('movie', 1001)]})
            expect(p.owns.first().id).to.equal(id)
          })

        })

      })

    })

  })

  describe('rebase', function() {
    // TODO

    it('works without offset', function() {
      let db1 = fixture.db.copy()
      let db2 = fixture.db.copy()
      let p0 = db1.create2('person', {})
      let p1 = db1.create2('person', {})
      let m = db2.create2('movie', {})
      let db3 = db1.rebase(db2)
      let diffs = db3.getLocalDiffs()
      expect(diffs.size).to.equal(3)
      expect(db3.get(p0).id).to.equal(p0.id)
      expect(db3.get(p1).id).to.equal(p1.id)
      expect(db3.get(m).id).to.equal(m.id)
    })

    it('works with offset', function() {
      let db1 = fixture.db.copy()
      let db2 = fixture.db.copy()
      let p0 = db1.create2('person', {})
      let p1 = db1.create2('person', {})
      let m = db2.create2('movie', {})
      let db3 = db1.rebase(db2, 1)
      let diffs = db3.getLocalDiffs()
      expect(diffs.size).to.equal(2)
      expect(db3.get(p1).id).to.equal(p1.id)
      expect(db3.get(p0)).to.be.undefined()
      expect(db3.get(m).id).to.equal(m.id)
    })

  })

})
