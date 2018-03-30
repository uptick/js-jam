import 'isomorphic-fetch'
import {expect} from 'code'

import {OrderedSet} from 'immutable'
import moment from 'moment'

import Model from '../src/model'
import Instance from '../src/instance'
import {makeId, isRecord} from '../src/utils'

// Don't dump stuff to the terminal.
console.debug = () => {}
console.warn = () => {}

describe('Model', function() {
  let modelDescr = {
    attributes: {
      a: {
        type: 'text',
        default: 'default'
      },
      b: {
        type: 'timestamp'
      }
    },
    relationships: {
      c: {
        type: 'test'
      },
      d: {
        type: 'test',
        many: true
      }
    }
  }
  let model = new Model('test', modelDescr)
  let data = {
    id: 1,
    a: 'hello',
    b: '2017-03-28T05:40:41.000Z',
    c: {_type: 'test', id: 1},
    d: [{_type: 'test', id: 1}, {_type: 'test', id: 2}],
    unknown: 'unknown'
  }

  describe('conversion to data', function() {

    it('converts known fields', function() {
      let r = model.toData(data)
      expect(r.a).to.equal(data.a)
      expect(r.b.isSame(moment(data.b))).to.be.true()
      expect(r.c.equals(makeId(data.c))).to.be.true()
      expect(r.d.equals(new OrderedSet(data.d.map(x => makeId(x))))).to.be.true()
    })

    it('ignores unknown fields', function() {
      let r = model.toData(data)
      expect(r.unkown).to.be.undefined()
    })

    it('includes type and ID', function() {
      let r = model.toData(data)
      expect(r._type).to.equal('test')
      expect(r.id).to.equal(1)
    })

  })

  describe('conversion to a record', function() {

    it('returns a record', function() {
      let r = model.toObject(data)
      expect(isRecord(r)).to.be.true()
    })

    it('converts known fields', function() {
      let r = model.toObject(data)
      expect(r.a).to.equal(data.a)
      expect(r.b.isSame(moment(data.b))).to.be.true()
      expect(r.c.equals(makeId(data.c))).to.be.true()
      expect(r.d.equals(new OrderedSet(data.d.map(x => makeId(x))))).to.be.true()
    })

    it('ignores unknown fields', function() {
      let r = model.toObject(data)
      expect(r.unkown).to.be.undefined()
    })

    it('accepts an existing record', function() {
      let r = model.toObject(data)
      r = model.toObject(r)
      expect(r.a).to.equal(data.a)
      expect(r.b.isSame(moment(data.b))).to.be.true()
      expect(r.c.equals(makeId(data.c))).to.be.true()
      expect(r.d.equals(new OrderedSet(data.d.map(x => makeId(x))))).to.be.true()
    })

    it('usese default values', function() {
      const {a, ...d0} = data
      let r = model.toObject(d0)
      expect(r.a).to.equal('default')
    })

  })

  describe('conversion to an instance', function() {

    it('returns an instance', function() {
      let r = model.toInstance(model.toObject(data), 'db')
      expect(Instance.isInstance(r)).to.be.true()
    })

  })

  describe('diff', function() {

    describe('returns null', function() {

      it('with empty values', function() {
        expect(model.diff(null, null)).to.be.null()
        expect(model.diff(null, undefined)).to.be.null()
        expect(model.diff(null, '')).to.be.null()
        expect(model.diff(undefined, null)).to.be.null()
        expect(model.diff(undefined, undefined)).to.be.null()
        expect(model.diff(undefined, '')).to.be.null()
        expect(model.diff('', null)).to.be.null()
        expect(model.diff('', undefined)).to.be.null()
        expect(model.diff('', '')).to.be.null()
      })

      it('with the same values', function() {
        let d0 = model.toObject({...data})
        let d1 = model.toObject({...data})
        expect(model.diff(d0, d1)).to.be.null()
      })

    })

    describe('returns diffed values', function() {

      it('with different values', function() {
        let d0 = model.toObject({...data})
        let d1 = model.toObject({
          ...data,
          a: 'world'
        })
        let d = model.diff(d0, d1)
        expect(d._type).to.equal(['test', 'test'])
        expect(d.id).to.equal([data.id, data.id])
        expect(d.a).to.equal(['hello', 'world'])
        expect(d.b).to.be.undefined()
        expect(d.c).to.be.undefined()
        expect(d.d).to.be.undefined()
        expect(d.unknown).to.be.undefined()
      })

    })

  })

  describe('applying a diff', function() {
    let d0 = model.toObject({...data})
    let d1 = model.toObject({
      ...data,
      a: 'world',
      c: null,
      d: [{_type: 'test', id: 2}, {_type: 'test', id: 3}]
    })
    let d = model.diff(d0, d1)

    it('without reverse moves forward', function() {
      let r = model.applyDiff(d0, d)
      expect(r.toJS()).to.equal(d1.toJS())
    })

    it('with reverse moves backward', function() {
      let r = model.applyDiff(d0, d, true)
      expect(r.toJS()).to.equal(d0.toJS())
    })

    it('creates new records', function() {
      let d = model.diff(null, d1)
      let r = model.applyDiff(null, d)
      expect(r.toJS()).to.equal(d1.toJS())
    })

    it('removes records', function() {
      let d = model.diff(d0, null)
      let r = model.applyDiff(d0, d)
      expect(r).to.be.null()
    })

  })

})
