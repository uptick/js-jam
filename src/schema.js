import {Map} from 'immutable'

import DB from './db'
import Model from './model'
import {ModelError} from './utils'

export default class Schema {

  constructor(descr = {}) {
    this.models = new Map()
    this.merge(descr)
  }

  merge(descr = {}) {
    for(const type of Object.keys(descr)) {
      let model = this.getModel(type)
      if( model === undefined ) {
        model = new Model( type )
      }
      model.merge( descr[type] )
      this.models = this.models.set( type, model )
    }
    this._updateReverseRelationships()
  }

  _updateReverseRelationships() {
    this.models.forEach( (model, name) => {
      model.relationships.forEach( (relDescr, field) => {
        if( !relDescr.has( 'relatedName' ) || !relDescr.has( 'type' ) || relDescr.get( 'reverse' ) )
          return
        let relModel
        try {
          relModel = this.getModel( relDescr.get( 'type' ), true )
        }
        catch( e ) {
          console.warn( `Unable to find related type "${relDescr.get('type')}", from "${model.type}.${field}"` )
          return
        }
        relModel.addReverseRelationship( relDescr.get( 'relatedName' ), new Map({
          type: model.type,
          relatedName: field,
          reverse: true,
          many: true
        }))
        this.models = this.models.set( relModel.type, relModel )
      })
    })
  }

  db( data ) {
    return new DB( data, {schema: this} )
  }

  view( view ) {
    return {
      schema: this,
      ...view
    }
  }

  getModel( type, fail = false ) {
    let model = this.models.get( type )
    if( fail && model === undefined ) {
      throw new ModelError( `Unknown model type: ${type}` )
    }
    return model
  }

  toInstance( data, db ) {
    const model = this.getModel( data._type )
    if( model === undefined )
      throw new ModelError( `Unknown model type: ${data._type}` )
    return model.toInstance( data, db )
  }

  toObjects( data, db ) {
    return data.map( objData => this.toObject( objData, db ) )
  }

  toObject( data, db ) {
    const model = this.getModel( data._type )
    if( model === undefined )
      throw new ModelError( `Unknown model type: ${data._type}` )
    return model.toObject( data, db )
  }

  createInstance( type, data, db ) {
    let model = this.getModel( type )
    return new model.Instance( new Map( (data || {}) ), model, db )
  }

        /* calcDiffs( state ) {
           let diffs = []
           const { collections: { local }} = state
           for( const type of Object.keys( local ) ) {
           for( const id of Object.keys( local[type] ) ) {
           const result = Model.calcDiff( state, type, id )
           if( result )
           diffs.append( result )
           }
           }
           return diffs
           }

           sync() {
           const diffs = this.calcDiffs()
           let deferred = []
           for( const diff of diffs ) {
           let def
           if( diff.op == 'create' )
           def = this.create( diff )
           else if( diff.op == 'remove' )
           def = this.remove( diff )
           else
           def = this.update( diff )
           deferred.push( def )
           }
           return Promise.all( deferred )
           .then( () => diffs )
           }

           create( diff ) {
           const type = diff.model.type.toLowerCase()
           return this[type].create( diff.model )
           }

           remove( diff ) {
           const type = diff.model.type.toLowerCase()
           return this[type].remove( diff.model.id )
           }

           update( diff ) {
           const type = diff.model.type.toLowerCase()
           let fields = {}
           for( const name of diff.fields )
           fields[name] = diff.model.attributes[name]
           const data = {
           id: diff.model.id,
           attributes: fields
           }
           return this[type].update( data )
           } */
}
