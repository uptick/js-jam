import 'isomorphic-fetch'
import {expect} from 'code'

import F from '../src/filter'
import {makeId} from '../src/utils'

import './silence'
import * as fixture from './fixture'

describe('Filter', function() {
  let db = fixture.db

  describe('equality', function() {

    it('returns empty when nothing matches', function() {
      let flt = F.eq('title', 'X')
      let r = db.filter('movie', flt)
      expect(r.size).to.equal(0)
    })

    it('returns values when partially matches', function() {
      let r = db.filter('movie', F.eq('title', 'Rocky'))
      expect(r.size).to.equal(1)
      expect(r.first().title).to.equal('Rocky')
      r = db.filter('movie', F.eq('title', 'Back to the Future'))
      expect(r.size).to.equal(1)
      expect(r.first().title).to.equal('Back to the Future')
    })

    it('negates correctly', function() {
      let r = db.filter('movie', F.eq('title', 'Rocky').not())
      expect(r.size).to.equal(3)
      expect(r.first().title).to.equal('Rocky 2')
    })

  })

  describe('includes', function() {

    it('returns empty when nothing matches', function() {
      let flt = F.in('title', 'X')
      let r = db.filter('movie', flt)
      expect(r.size).to.equal(0)
    })

    it('returns matches for text', function() {
      let flt = F.in('title', 'Rocky')
      let r = db.filter('movie', flt)
      expect(r.size).to.equal(3)
    })

    it('returns matches for many-to-many', function() {
      let flt = F.in('actors', makeId('person', 1))
      let r = db.filter('movie', flt)
      expect(r.size).to.equal(3)
      expect(r.first().title).to.equal('Rocky')
    })

    it('negates correctly', function() {
      let flt = F.in('actors', makeId('person', 1)).not()
      let r = db.filter('movie', flt)
      expect(r.size).to.equal(1)
      expect(r.first().title).to.equal('Back to the Future')
    })

  })

  describe('intersection', function() {

    it('returns combined sets', function() {
      let flt = F.eq('title', 'Rocky').and(F.eq('duration', 3))
      let r = db.filter('movie', flt)
      expect(r.size).to.equal(0)
      flt = F.eq('title', 'Rocky').and(F.eq('duration', 58))
      r = db.filter('movie', flt)
      expect(r.size).to.equal(1)
      expect(r.first().title).to.equal('Rocky')
    })

    it('negates correctly', function() {
      let flt = F.eq('title', 'Rocky').and(F.eq('duration', 58)).not()
      let r = db.filter('movie', flt)
      expect(r.size).to.equal(3)
      expect(r.first().title).to.equal('Rocky 2')
    })

  })

  describe('union', function() {

    it('returns combined sets', function() {
      let flt = F.eq('title', 'Rocky').or(F.eq('duration', 40))
      let r = db.filter('movie', flt)
      expect(r.size).to.equal(2)
      expect(r.first().title).to.equal('Rocky')
      expect(r.last().title).to.equal('Rocky 2')
    })

    it('negates correctly', function() {
      let flt = F.eq('title', 'Rocky').or(F.eq('duration', 40)).not()
      let r = db.filter('movie', flt)
      expect(r.size).to.equal(2)
      expect(r.last().title).to.equal('Rocky 3')
      expect(r.first().title).to.equal('Back to the Future')
    })

  })

  describe('lookups', function() {

    it('return empty sets when unmatched', function() {
      let flt = F.in('actors__name', 'X')
      let r = db.filter('movie', flt)
      expect(r.size).to.equal(0)
      flt = F.in('director__name', 'X')
      r = db.filter('movie', flt)
      expect(r.size).to.equal(0)
    })

    it('work with many-to-many fields', function() {
      let flt = F.in('actors__name', 'Stalone')
      let r = db.filter('movie', flt)
      expect(r.size).to.equal(3)
      expect(r.first().title).to.equal('Rocky')
    })

    it('work with foreign-key fields', function() {
      let flt = F.in('director__name', 'Babalooney')
      let r = db.filter('movie', flt)
      expect(r.size).to.equal(1)
      expect(r.first().title).to.equal('Rocky')
    })

  })

})
