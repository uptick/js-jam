import {expect} from 'code'

import moment from 'moment'

import Field from '../src/field'
import {makeId} from '../src/utils'

import './silence'

describe('Field', function() {

  describe('equality', function() {

    describe('with unknown type', function() {

      describe('returns true', function() {

        it('with both null', function() {
          expect(Field.equals('unknown', null, null)).to.be.true()
        })

        it('with null and undefined ', function() {
          expect(Field.equals('unknown', null, undefined)).to.be.true()
        })

        it('with undefined and null', function() {
          expect(Field.equals('unknown', undefined, null)).to.be.true()
        })

        it('with equal values', function() {
          expect(Field.equals('unknown', 'ab', 'ab')).to.be.true()
        })

      })

      describe('returns false', function() {

        it('with empty string and null', function() {
          expect(Field.equals('unknown', '', null)).to.be.false()
        })

        it('with null and empty string', function() {
          expect(Field.equals('unknown', null, '')).to.be.false()
        })

        it('with empty string and undefined', function() {
          expect(Field.equals('unknown', '', undefined)).to.be.false()
        })

        it('with undefined and empty string', function() {
          expect(Field.equals('unknown', undefined, '')).to.be.false()
        })

        it('with unequal values', function() {
          expect(Field.equals('unknown', 'ab', 'ba')).to.be.false()
        })

      })

    })

    describe('with boolean type', function() {

      describe('returns true', function() {

        it('with both null', function() {
          expect(Field.equals('boolean', null, null)).to.be.true()
        })

        it('with null and undefined ', function() {
          expect(Field.equals('boolean', null, undefined)).to.be.true()
        })

        it('with undefined and null', function() {
          expect(Field.equals('boolean', undefined, null)).to.be.true()
        })

        it('with both true', function() {
          expect(Field.equals('boolean', true, true)).to.be.true()
        })

        it('with both false', function() {
          expect(Field.equals('boolean', false, false)).to.be.true()
        })

      })

      describe('returns false', function() {

        it('with empty string and null', function() {
          expect(Field.equals('boolean', '', null)).to.be.false()
        })

        it('with null and empty string', function() {
          expect(Field.equals('boolean', null, '')).to.be.false()
        })

        it('with empty string and undefined', function() {
          expect(Field.equals('boolean', '', undefined)).to.be.false()
        })

        it('with undefined and empty string', function() {
          expect(Field.equals('boolean', undefined, '')).to.be.false()
        })

        it('with true and false', function() {
          expect(Field.equals('boolean', true, false)).to.be.false()
        })

        it('with true and false', function() {
          expect(Field.equals('boolean', true, false)).to.be.false()
        })

      })

    })

    describe('with timestamp type', function() {

      describe('returns true', function() {

        it('with both null', function() {
          expect(Field.equals('timestamp', null, null)).to.be.true()
        })

        it('with null and undefined ', function() {
          expect(Field.equals('timestamp', null, undefined)).to.be.true()
        })

        it('with undefined and null', function() {
          expect(Field.equals('timestamp', undefined, null)).to.be.true()
        })

        it('with equal values', function() {
          let a = moment('2018-03-28T05:40:41+00:00')
          let b = moment('2018-03-28T05:40:41+00:00')
          expect(Field.equals('timestamp', a, b)).to.be.true()
        })

        it('with the same object', function() {
          let a = moment('2018-03-28T05:40:41+00:00')
          expect(Field.equals('timestamp', a, a)).to.be.true()
        })

      })

      describe('returns false', function() {

        it('with empty string and null', function() {
          expect(Field.equals('timestamp', '', null)).to.be.false()
        })

        it('with null and empty string', function() {
          expect(Field.equals('timestamp', null, '')).to.be.false()
        })

        it('with empty string and undefined', function() {
          expect(Field.equals('timestamp', '', undefined)).to.be.false()
        })

        it('with undefined and empty string', function() {
          expect(Field.equals('timestamp', undefined, '')).to.be.false()
        })

        it('with unequal values', function() {
          let a = moment('2018-03-28T05:40:41+00:00')
          let b = moment('2017-03-28T05:40:41+00:00')
          expect(Field.equals('timestamp', a, b)).to.be.false()
        })

      })

    })

    describe('with foreignkey type', function() {

      describe('returns true', function() {

        it('with both null', function() {
          expect(Field.equals('foreignkey', null, null)).to.be.true()
        })

        it('with null and undefined ', function() {
          expect(Field.equals('foreignkey', null, undefined)).to.be.true()
        })

        it('with undefined and null', function() {
          expect(Field.equals('foreignkey', undefined, null)).to.be.true()
        })

        it('with equal values', function() {
          let a = makeId('a', 1)
          let b = makeId('a', 1)
          expect(Field.equals('foreignkey', a, b)).to.be.true()
        })

        it('with the same object', function() {
          let a = makeId('a', 1)
          expect(Field.equals('foreignkey', a, a)).to.be.true()
        })

      })

      describe('returns false', function() {

        it('with empty string and null', function() {
          expect(Field.equals('foreignkey', '', null)).to.be.false()
        })

        it('with null and empty string', function() {
          expect(Field.equals('foreignkey', null, '')).to.be.false()
        })

        it('with empty string and undefined', function() {
          expect(Field.equals('foreignkey', '', undefined)).to.be.false()
        })

        it('with undefined and empty string', function() {
          expect(Field.equals('foreignkey', undefined, '')).to.be.false()
        })

        it('with unequal values', function() {
          let a = makeId('a', 1)
          let b = makeId('b', 1)
          expect(Field.equals('foreignkey', a, b)).to.be.false()
        })

      })

    })

    describe('with manytomany type', function() {

      describe('returns true', function() {

        it('with both null', function() {
          expect(Field.equals('manytomany', null, null)).to.be.true()
        })

        it('with null and undefined ', function() {
          expect(Field.equals('manytomany', null, undefined)).to.be.true()
        })

        it('with undefined and null', function() {
          expect(Field.equals('manytomany', undefined, null)).to.be.true()
        })

        it('with empty sets', function() {
          expect(Field.equals('manytomany', [], [])).to.be.true()
        })

        it('with equal values', function() {
          let a = [
            makeId('a', 1),
            makeId('b', 1)
          ]
          let b = [
            makeId('a', 1),
            makeId('b', 1)
          ]
          expect(Field.equals('manytomany', a, b)).to.be.true()
        })

        it('with the same object', function() {
          let a = [
            makeId('a', 1),
            makeId('b', 1)
          ]
          expect(Field.equals('manytomany', a, a)).to.be.true()
        })

      })

      describe('returns false', function() {

        it('with empty string and null', function() {
          expect(Field.equals('manytomany', '', null)).to.be.false()
        })

        it('with null and empty string', function() {
          expect(Field.equals('manytomany', null, '')).to.be.false()
        })

        it('with empty string and undefined', function() {
          expect(Field.equals('manytomany', '', undefined)).to.be.false()
        })

        it('with undefined and empty string', function() {
          expect(Field.equals('manytomany', undefined, '')).to.be.false()
        })

        it('with extra elements', function() {
          let a = [
            makeId('a', 1),
            makeId('b', 1)
          ]
          let b = [
            makeId('a', 1),
            makeId('b', 1),
            makeId('c', 1)
          ]
          expect(Field.equals('manytomany', a, b)).to.be.false()
        })

        it('with unequal values', function() {
          let a = [
            makeId('a', 1),
            makeId('b', 1)
          ]
          let b = [
            makeId('a', 1),
            makeId('b', 2)
          ]
          expect(Field.equals('manytomany', a, b)).to.be.false()
        })

      })

    })

  })

  describe('conversion to internal', function() {

    describe('with unknown type', function() {

      describe('returns null', function() {

        it('with null', function() {
          expect(Field.toInternal('unknown', null)).to.be.null()
        })

        it('with undefined', function() {
          expect(Field.toInternal('unknown', undefined)).to.be.null()
        })

      })

      it('returns the same value', function() {
        expect(Field.toInternal('unknown', '')).to.equal('')
        expect(Field.toInternal('unknown', 'a')).to.equal('a')
        expect(Field.toInternal('unknown', 1)).to.equal(1)
      })

    })

    describe('with boolean type', function() {

      describe('returns null', function() {

        it('with null', function() {
          expect(Field.toInternal('boolean', null)).to.be.null()
        })

        it('with undefined', function() {
          expect(Field.toInternal('boolean', undefined)).to.be.null()
        })

        it('with empty string', function() {
          expect(Field.toInternal('boolean', '')).to.be.null()
        })

      })

      describe('returns true', function() {

        it('with true', function() {
          expect(Field.toInternal('boolean', true)).to.be.true()
        })

        it('with the string "true"', function() {
          expect(Field.toInternal('boolean', 'true')).to.be.true()
        })

        it('with the string "TRUE"', function() {
          expect(Field.toInternal('boolean', 'TRUE')).to.be.true()
        })

        it('with 1', function() {
          expect(Field.toInternal('boolean', 1)).to.be.true()
        })

      })

      it('returns false with anything else', function() {
        expect(Field.toInternal('boolean', 0)).to.be.false()
        expect(Field.toInternal('boolean', 'blah')).to.be.false()
        expect(Field.toInternal('boolean', false)).to.be.false()
      })

    })

    describe('with timestamp type', function() {

      describe('returns null', function() {

        it('with null', function() {
          expect(Field.toInternal('timestamp', null)).to.be.null()
        })

        it('with undefined', function() {
          expect(Field.toInternal('timestamp', undefined)).to.be.null()
        })

        it('with empty string', function() {
          expect(Field.toInternal('timestamp', '')).to.be.null()
        })

      })

      describe('returns a moment object', function() {

        it('with a moment object', function() {
          let a = moment('2017-03-28T05:40:41+00:00')
          expect(Field.toInternal('timestamp', a)).to.satisfy(x => moment.isMoment(x))
        })

        it('with an ISO8601 string', function() {
          let a = '2017-03-28T05:40:41+00:00'
          expect(Field.toInternal('timestamp', a)).to.satisfy(x => moment.isMoment(x))
        })

      })

    })

    describe('with foreignkey type', function() {

      describe('returns null', function() {

        it('with null', function() {
          expect(Field.toInternal('foreignkey', null)).to.be.null()
        })

        it('with undefined', function() {
          expect(Field.toInternal('foreignkey', undefined)).to.be.null()
        })

        it('with empty string', function() {
          expect(Field.toInternal('foreignkey', '')).to.be.null()
        })

      })

      describe('returns an ID', function() {

        it('with an object', function() {
          let a = {type: 'a', id: 1}
          let r = Field.toInternal('foreignkey', a)
          expect(r._type).to.equal('a')
          expect(r.id).to.equal(1)
        })

      })

    })

    describe('with manytomany type', function() {

      describe('returns empty set', function() {

        it('with null', function() {
          let r = Field.toInternal('manytomany', null)
          expect(r.length).to.equal(0)
        })

        it('with undefined', function() {
          let r = Field.toInternal('manytomany', undefined)
          expect(r.length).to.equal(0)
        })

        it('with empty string', function() {
          let r = Field.toInternal('manytomany', '')
          expect(r.length).to.equal(0)
        })

        it('with empty array', function() {
          let r = Field.toInternal('manytomany', [])
          expect(r.length).to.equal(0)
        })

      })

      describe('returns a filled set', function() {

        it('with an array of objects', function() {
          let a = [{type: 'a', id: 1}, {type: 'a', id: 2}]
          let r = Field.toInternal('manytomany', a)
          expect(r).to.equal(a.map(x => makeId(x)))
        })

      })

    })

  })

  describe('conversion from internal', function() {

    describe('with unknown type', function() {

      describe('returns null', function() {

        it('with null', function() {
          expect(Field.fromInternal('unknown', null)).to.be.null()
        })

        it('with undefined', function() {
          expect(Field.fromInternal('unknown', undefined)).to.be.null()
        })

      })

      it('returns the same value', function() {
        expect(Field.fromInternal('unknown', '')).to.equal('')
        expect(Field.fromInternal('unknown', 'a')).to.equal('a')
        expect(Field.fromInternal('unknown', 1)).to.equal(1)
      })

    })

    describe('with boolean type', function() {

      describe('returns null', function() {

        it('with null', function() {
          expect(Field.fromInternal('boolean', null)).to.be.null()
        })

        it('with undefined', function() {
          expect(Field.fromInternal('boolean', undefined)).to.be.null()
        })

      })

      it('returns same value', function() {
        expect(Field.fromInternal('boolean', true)).to.be.true()
        expect(Field.fromInternal('boolean', false)).to.be.false()
      })

    })

    describe('with timestamp type', function() {

      describe('returns null', function() {

        it('with null', function() {
          expect(Field.fromInternal('timestamp', null)).to.be.null()
        })

        it('with undefined', function() {
          expect(Field.fromInternal('timestamp', undefined)).to.be.null()
        })

        it('with empty string', function() {
          expect(Field.fromInternal('timestamp', '')).to.be.null()
        })

      })

      describe('returns an ISO8601 string', function() {

        it('with a moment object', function() {
          let a = '2017-03-28T05:40:41.000Z'
          expect(Field.fromInternal('timestamp', moment(a))).to.equal(a)
        })

      })

    })

    describe('with foreignkey type', function() {

      describe('returns null', function() {

        it('with null', function() {
          expect(Field.fromInternal('foreignkey', null)).to.be.null()
        })

        it('with undefined', function() {
          expect(Field.fromInternal('foreignkey', undefined)).to.be.null()
        })

        it('with empty string', function() {
          expect(Field.fromInternal('foreignkey', '')).to.be.null()
        })

      })

      describe('returns an object', function() {

        it('with an ID', function() {
          let a = makeId('a', 1)
          let r = Field.fromInternal('foreignkey', a)
          expect(r).to.equal({type: 'a', id: 1})
        })

      })

    })

    describe('with manytomany type', function() {

      describe('returns empty array', function() {

        it('with null', function() {
          let r = Field.fromInternal('manytomany', null)
          expect(r).to.equal([])
        })

        it('with undefined', function() {
          let r = Field.fromInternal('manytomany', undefined)
          expect(r).to.equal([])
        })

        it('with empty string', function() {
          let r = Field.fromInternal('manytomany', '')
          expect(r).to.equal([])
        })

        it('with empty array', function() {
          let r = Field.fromInternal('manytomany', [])
          expect(r).to.equal([])
        })

      })

      describe('returns a filled array', function() {

        it('with an array of IDs', function() {
          let a = [makeId('a', 1), makeId('a', 2)]
          let r = Field.fromInternal('manytomany', a)
          expect(r).to.equal(a.map(x => ({type: x._type, id: x.id})))
        })

      })

    })

  })

  describe('diff', function() {

    describe('with unknown type', function() {

      describe('returns null', function() {

        it('with empty values', function() {
          expect(Field.diff('unknown', null, null)).to.be.null()
          expect(Field.diff('unknown', null, undefined)).to.be.null()
          expect(Field.diff('unknown', undefined, null)).to.be.null()
          expect(Field.diff('unknown', undefined, undefined)).to.be.null()
        })

        it('with the same values', function() {
          expect(Field.diff('unknown', 'a', 'a')).to.be.null()
          expect(Field.diff('unknown', 0, 0)).to.be.null()
        })

      })

      describe('returns to value', function() {

        it('with different values', function() {
          expect(Field.diff('unknown', 'a', 'b')).to.equal('b')
          expect(Field.diff('unknown', 0, 1)).to.be.equal(1)
        })

      })

    })

    describe('with many to many', function() {

      describe('returns null', function() {

        it('with null and undefined values', function() {
          expect(Field.diff('manytomany', null, null)).to.be.null()
          expect(Field.diff('manytomany', null, undefined)).to.be.null()
          expect(Field.diff('manytomany', undefined, null)).to.be.null()
          expect(Field.diff('manytomany', undefined, undefined)).to.be.null()
        })

        it('with the same values', function() {
          let a = [makeId('a', 1), makeId('a', 2)]
          let b = [makeId('a', 1), makeId('a', 2)]
          expect(Field.diff('manytomany', a, b)).to.be.null()
        })

      })

      describe('returns subtracted sets', function() {

        it('with different values', function() {
          let a = [makeId('a', 1), makeId('b', 1)]
          let b = [makeId('a', 1), makeId('a', 2)]
          let c = [makeId('b', 1)]
          let d = [makeId('a', 2)]
          let e = Field.diff('manytomany', a, b)
          let f = Field.diff('manytomany', b, a)
          expect(e[0]).to.equal(c)
          expect(e[1]).to.equal(d)
          expect(f[0]).to.equal(d)
          expect(f[1]).to.equal(c)
        })

      })

    })

  })

})
