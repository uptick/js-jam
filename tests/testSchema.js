import {expect} from 'code'

import Schema from '../src/schema'

import './silence'
import {movieSchema, movieJsonApi} from './fixture'

describe('Schema', function() {

  describe('JsonApi response flattening', function() {

    describe('with movie fixture', function() {
      const schema = new Schema(movieSchema)
      const data = schema.fromJsonApi(movieJsonApi)

      it('produces a list of main data only', function() {
        expect(data.length).to.equal(4)
        data.forEach(item => expect(item._type).to.equal('movie'))
      })

      it('links included resources', function() {
        expect(data[0].actors[0]._type).to.equal('person')
        expect(data[0].actors[0].id).to.equal(1)
        expect(data[1].actors[0]._type).to.equal('person')
        expect(data[1].actors[0].id).to.equal(1)
      })

      it('linked includes are references', function() {
        data[0].actors[0].extra = 'test'
        expect(data[1].actors[0].extra).to.equal('test')
      })

    })

  })

  describe('JsonApi rendering', function() {

    describe('with movie fixture', function() {
      const schema = new Schema(movieSchema)
      const data = schema.toJsonApi(schema.fromJsonApi(movieJsonApi))

      it('maps back to original', function() {
        expect(data.data).to.equal(movieJsonApi.data)
      })

    })

  })

})
