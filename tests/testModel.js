import {expect} from 'code'

import moment from 'moment'

import Model from '../src/model'
import {makeId} from '../src/utils'

import './silence'

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
    c: {type: 'test', id: 1},
    d: [{type: 'test', id: 1}, {type: 'test', id: 2}],
    unknown: 'unknown'
  }

  describe('conversion to internal', function() {

    it('converts known fields', function() {
      let r = model.toInternal(data)
      expect(r.a).to.equal(data.a)
      expect(r.b.isSame(moment(data.b))).to.be.true()
      expect(r.c).to.equal(makeId(data.c))
      expect(r.d).to.equal(data.d.map(x => makeId(x)))
    })

    it('ignores unknown fields', function() {
      let r = model.toInternal(data)
      expect(r.unkown).to.be.undefined()
    })

    it('includes type and ID', function() {
      let r = model.toInternal(data)
      expect(r._type).to.equal('test')
      expect(r.id).to.equal(1)
    })

  })

  /* describe('diff', function() {

   *   describe('returns null', function() {

   *     it('with empty values', function() {
   *       expect(model.diff(null, null)).to.be.null()
   *       expect(model.diff(null, undefined)).to.be.null()
   *       expect(model.diff(null, '')).to.be.null()
   *       expect(model.diff(undefined, null)).to.be.null()
   *       expect(model.diff(undefined, undefined)).to.be.null()
   *       expect(model.diff(undefined, '')).to.be.null()
   *       expect(model.diff('', null)).to.be.null()
   *       expect(model.diff('', undefined)).to.be.null()
   *       expect(model.diff('', '')).to.be.null()
   *     })

   *     it('with the same values', function() {
   *       let d0 = model.toInternal({...data})
   *       let d1 = model.toInternal({...data})
   *       expect(model.diff(d0, d1)).to.be.null()
   *     })

   *   })

   *   describe('returns diffed values', function() {

   *     it('with different values', function() {
   *       let d0 = model.toInternal({...data})
   *       let d1 = model.toInternal({
   *         ...data,
   *         a: 'world'
   *       })
   *       let d = model.diff(d0, d1)
   *       expect(d._type).to.equal(['test', 'test'])
   *       expect(d.id).to.equal([data.id, data.id])
   *       expect(d.a).to.equal(['hello', 'world'])
   *       expect(d.b).to.be.undefined()
   *       expect(d.c).to.be.undefined()
   *       expect(d.d).to.be.undefined()
   *       expect(d.unknown).to.be.undefined()
   *     })

   *   })

   * }) */

})
