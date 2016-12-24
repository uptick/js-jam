import { bindActionCreators } from 'redux';
import uuid from 'uuid';
import { List, Map } from 'immutable';

import Table from './table';
import { toArray, makeId, getDiffOp, getDiffId, isObject, Rollback, ModelError, splitJsonApiResponse } from './utils';
import * as modelActions from './actions';

export default class DB {

  static Rollback = Rollback;

  /**
   * Construct a DB from either a database data object, or a React
   * component. If using a React component, the data is assumed to
   * reside under `props.models.db`.
   */
  constructor( data, options={} ) {
    this.schema = options.schema;
    if( data ) {
      if( Map.isMap( data ) )
        this.data = data;
      else
        throw new ModelError( 'Unknown data given to DB constructor.' );
    }
    else
      this.reset();
  }

  reset() {
    this.data = new Map({
      head: new Map(),
      ids: new Map(),
      chain: new Map({
        diffs: new List(),
        blocks: new List(),
        current: 0,
        server: 0
      })
    });
  }

  resetHead() {
    this.data = this.data.set( 'head', new Map() );
  }

  bindDispatch( dispatch ) {
    this.dispatch = dispatch;
    this.actions = bindActionCreators( modelActions, dispatch );
  }

  /**
   * Load models from JSON API format.
   */
  loadJsonApi( response ) {
    const objects = splitJsonApiResponse( response );

    // Cache the latest redo position. We don't want to revert the
    // state of the DB too far.
    const current = this.data.getIn( ['chain', 'current'] );

    // Walk back the diff chain to get the current data into
    // server configuration.
    this.undoAll();

    // Now update the head data state to reflect the new server
    // information.
    Object.keys( objects ).forEach( type => {
      let tbl = this.getTable( type );
      objects[type].map( obj => {
        tbl.set( obj );
      });
      this.saveTable( tbl );
    });

    // Recalculate reverse-related fields.
    this._updateReverseRelationships();

    // Replay all the diffs to bring us back to the correct position.
    this.goto( current );
  }

  _updateReverseRelationships() {
    this.data.get( 'head' ).forEach( (tblData, type) => {
      let tbl = this.getTable( type );
      tbl.model.relationships.forEach( (relInfo, field) => {
        if( relInfo.get( 'reverse' ) )
          return;
        tbl.data.get( 'objects' ).forEach( obj => {

          // `obj` can be null if we've removed some objects.
          if( obj === null )
            return;

          for( const rel of tbl.iterRelated( obj.id, field ) ) {
            let relTbl = this.getTable( rel._type );
            const relName = relInfo.get( 'relatedName' );
            if( relName ) {
              const relObj = relTbl.get( rel.id );
              if( relObj !== undefined ) {
                if( !tbl.model.fieldIsForeignKey( relName ) )
                  relTbl.addRelationship( rel.id, relName, obj );
                else
                  relTbl.set( relTbl.get( rel.id ).set( relName, obj ) );
              }
              this.saveTable( relTbl );
            }
          }
        });
      });
    });
  }

  getId( typeOrObject, id ) {
    id = makeId( typeOrObject, id );
    return this.data.getIn( ['ids', id._type, id.id], id );
  }

  makeId( typeOrObject, id ) {
    id = makeId( typeOrObject, id );
    let res = this.data.getIn( ['ids', id._type, id.id] );
    if( res === undefined ) {
      this.data = this.data.setIn( ['ids', id._type, id.id], id );
      res = id;
    }
    return res;
  }

  getModel( type ) {
    return this.schema.getModel( type );
  }

  getTable( type ) {
    const data = this.data.getIn( ['head', type] );
    return new Table( type, {data, db: this} );
  }

  saveTable( table ) {
    this.data = this.data.setIn( ['head', table.type], table.data );
  }

  toObject( data ) {
    return this.schema.toObject( data, this );
  }

  toObjects( data ) {
    return this.schema.toObjects( data, this );
  }

  /**
   * get( object )
   * get( {_type:, id:}
   * get( '', 3 )
   * get( '', {key: } )
   */
  get( typeOrQuery, idOrQuery ) {
    let query, type;
    if( idOrQuery === undefined ) {
      type = typeOrQuery._type;
      if( typeOrQuery._map !== undefined ) {
        query = {id: typeOrQuery.id};
      }
      else {
        const {_type: x, ...y} = typeOrQuery;
        query = y;
      }
    }
    else if( isObject( idOrQuery ) ) {
      type = typeOrQuery;
      query = idOrQuery;
    }
    else {
      type = typeOrQuery;
      query = {id: idOrQuery};
    }
    const data = this.data.getIn( ['head', type] );
    return this.getTable( type ).get( query );
  }

  getOrCreate( type, query, values ) {
    let obj = this.get( type, query );
    if( !obj ) {
      const id = this.create({
        _type: type,
        ...query,
        ...values
      });
      obj = this.get( id );
    }
    else {
      const model = this.getModel( type );
      obj = model.update( obj, values );
      this.update( obj );
    }
    return obj;
  }

  /**
   * Begin an atomic transaction.
   */
  withBlock( operation ) {
    if( this._inBlock )
      throw ModelError( 'Already in DB block.' );
    const chain = this.data.get( 'chain' );
    const current = chain.get( 'current' );
    try {
      operation();
      if( this.data.getIn( ['chain', 'current'] ) != current )
        this.data = this.data.updateIn( ['chain', 'blocks'], x => x.push( current ) );
      this._inBlock = false;
    }
    catch( err ) {
      this.goto( current );
      this.data = this.data.set( 'chain', chain );
      this._inBlock = false;
      if( !(err instanceof Rollback) )
        throw err;
    }
  }

  getBlock( index ) {
    const blocks = this.data.getIn( ['chain', 'blocks'] );
    const diffs = this.data.getIn( ['chain', 'diffs'] );
    if( index === undefined )
      index = 0;
    if( !blocks.size || index >= blocks.size )
      return [];
    const start = blocks.get( blocks.size - index - 1 );
    const finish = blocks.get( blocks.size - index );
    return diffs.slice( start, finish );
  }

  getBlocks( nBlocks ) {
    let blocks = [];
    for( let ii = 0; ii < nBlocks; ++ii )
      blocks.push( this.getBlock( nBlocks - ii - 1 ) );
    return blocks;
  }

  create( data ) {
    const model = this.getModel( data._type );
    let object = this.toObject( data );
    if( object.id === undefined )
      object = object.set( 'id', uuid.v4() );
    const diff = model.diff( undefined, object );
    this.addDiff( diff );
    return getDiffId( diff );
  }

  update( full, partial ) {
    let existing = this.get( full._type, full.id );
    if( existing === undefined )
      throw ModelError( 'Cannot update non-existant object.' );
    const model = this.getModel( existing._type );

    let updated;
    if( partial !== undefined ) {
      updated = existing;
      for( const field of model.iterFields() ) {
        if( field in partial )
          updated = updated.set( field, partial[field] );
      }
    }
    else
      updated = this.toObject( full );

    const diff = model.diff( existing, updated );
    if( diff )
      this.addDiff( diff );
  }

  /* getOrCreate( type, query ) {
     const obj = this.get( type, query );
     if( obj === undefined )
     return {_type: type, id: uuid.v4(), ...query};
     return obj;
     } */

  remove( typeOrObject, id ) {
    let type;
    if( id === undefined ) {
      type = typeOrObject._type;
      id = typeOrObject.id;
    }
    else
      type = typeOrObject;
    const model = this.getModel( type );
    let object = this.makeId( type, id );
    const diff = model.diff( object, undefined );
    this.addDiff( diff );
  }

  undoAll() {
    let current = this.data.getIn( ['chain', 'current'] );
    while( current ) {
      this.undo();
      current -= 1;
    }
  }

  undo() {
    const diffs = this.data.getIn( ['chain', 'diffs'] );
    const current = this.data.getIn( ['chain', 'current'] );
    if( !current )
      return;
    let diff = diffs.get( current - 1 );
    this.applyDiff( diff, true );
    this.data = this.data.setIn( ['chain', 'current'], current - 1 );
  }

  redoAll() {
    let current = this.data.getIn( ['chain', 'current'] );
    const diffs = this.data.getIn( ['chain', 'diffs'] );
    while( current < diffs.size ) {
      this.redo();
      current += 1;
    }
  }

  redo() {
    const diffs = this.data.getIn( ['chain', 'diffs'] );
    const current = this.data.getIn( ['chain', 'current'] );
    if( current == diffs.size )
      return;
    let diff = diffs.get( current );
    this.applyDiff( diff );
    this.data = this.data.setIn( ['chain', 'current'], current + 1 );
  }

  addBlock( block ) {
    const offset = this.data.getIn( ['chain', 'diffs'] ).size;
    for( const diff of block )
      this.addDiff( diff );
    this.data = this.data.updateIn( ['chain', 'blocks'], x => x.push( offset ) );
  }

  addDiff( diff ) {
    this.data = this.data
                    .updateIn( ['chain', 'diffs'], x => x.push( diff ) )
                    .updateIn( ['chain', 'current'], x => x + 1 );
    this.applyDiff( diff );
  }

  applyDiff( diff, reverse=false ) {
    const id = getDiffId( diff );
    let tbl = this.getTable( id._type );
    tbl.applyDiff( diff, reverse );
    this.saveTable( tbl );
    this._applyDiffRelationships( diff, reverse );
  }

  _applyDiffRelationships( diff, reverse=false ) {
    const ii = reverse ? 1 : 0;
    const jj = reverse ? 0 : 1;
    const id = getDiffId( diff );
    const model = this.getModel( id._type );
    for( const field of model.iterFields() ) {
      if( diff[field] === undefined )
        continue;
      const relInfo = model.relationships.get( field );
      if( !relInfo )
        continue;
      const relName = relInfo.get( 'relatedName' );
      const relType = relInfo.get( 'type' );
      if( relInfo.get( 'reverse' ) || !relName || !relType )
        continue;
      let tbl = this.getTable( relType );
      if( relInfo.get( 'many' ) ) {
        if( diff[field][ii] !== undefined ) {
          diff[field][ii].forEach( relId => {
            tbl.removeRelationship( relId.id, relName, id );
          });
        }
        if( diff[field][jj] !== undefined ) {
          diff[field][jj].forEach( relId => {
            tbl.addRelationship( relId.id, relName, id );
          });
        }
      }
      else {

        // Don't update the reverse relationships if the value
        // hasn't changed.
        if( diff[field][ii] != diff[field][jj] ) {
          let relId = diff[field][ii]
          if( relId )
            tbl.removeRelationship( relId.id, relName, id );
          relId = diff[field][jj]
          if( relId )
            tbl.addRelationship( relId.id, relName, id );
        }
      }
      this.saveTable( tbl );
    }
  }

  /**
   * Move current diff location to `index`.
   */
  goto( index ) {
    const diffs = this.data.getIn( ['chain', 'diffs'] );
    const current = this.data.getIn( ['chain', 'current'] );
    if( index > diffs.size )
      throw ValueError( 'Cannot goto index greater than number of diffs.' );
    if( index < 0 )
      throw ValueError( 'Cannot goto negative index.' );
    while( index < current ) {
      this.undo();
      index += 1;
    }
    while( index > current ) {
      this.redo();
      index -= 1;
    }
  }

  /**
   *
   */
  commitDiff( diff ) {

    // If no diff was given, use the oldest one available.
    // If no such diff is available then return.
    if( !diff ) {
      const server = this.data.getIn( ['chain', 'server'] );
      const current = this.data.getIn( ['chain', 'current'] );
      const diffs = this.data.getIn( ['chain', 'diffs'] );
      if( server >= current )
        return;
      diff = diffs.get( server );
    }
    console.debug( 'DB: committing: ', diff );

    // Find the model, convert data to JSON API, and send using
    // the appropriate operation.
    const type = getDiffId( diff )._type;
    const model = this.getModel( type );
    if( model === undefined )
      throw new ModelError( `No model of type "${type}" found during \`commitDiff\`.` );
    const op = getDiffOp( diff );
    const data = model.diffToJsonApi( diff );

    // Different method based on operation.
    let promise;
    if( op == 'create' ) {
      try {
        promise = model.ops.create( data )
                       .then( response => {
                         const {data} = response;
                         const id = toArray( data )[0].id;
                         this.reId( diff._type[1], diff.id[1], id );
                         return response;
                       });
      }
      catch( err ) {
        throw new ModelError( `Failed to execute create operation for type "${type}".` );
      }
    }
    else if( op == 'update' ) {
      try {
        promise = model.ops.update( data.data.id, data );
      }
      catch( err ) {
        throw new ModelError( `Failed to execute update operation for type "${type}".` );
      }
    }
    else if( op == 'remove' ) {
      try {
        promise = model.ops.remove( data.data.id );
      }
      catch( err ) {
        throw new ModelError( `Failed to execute remove operation for type "${type}".` );
      }
    }
    else
      throw new ModelError( `Unknown model operation: ${op}` );


    // Add on any many-to-many values.
    for( const field of model.iterManyToMany() ) {
      if( field in diff ) {
        promise = promise.then( response => {
          if( !model.ops[`${field}Add`] )
            throw new ModelError( `No many-to-many add declared for ${field}.` );
          model.ops[`${field}Add`]( diff[field][1] );
          return response;
        })
        .then( response => {
          if( !model.ops[`${field}Remove`] )
            throw new ModelError( `No many-to-many remove declared for ${field}.` );
          model.ops[`${field}Remove`]( diff[field][0] );
          return response;
        });
      }
    }

    // Finally, pop the diff.
    promise = promise.then( response => {
      this.data = this.data.updateIn( ['chain', 'server'], x => x + 1 );
      return response;
    });

    return promise;
  }

  postCommitDiff( diff, response ) {
    if( getDiffOp( diff ) == 'create' ) {
      const {data} = response;
      const id = toArray( data )[0].id;
      this.reId( diff._type[1], diff.id[1], id );
    }
  }

  popDiff() {
    this.data = this.data.updateIn( ['chain', 'server'], x => x + 1 );
  }

  reId( type, id, newId ) {
    console.debug( `DB: reId: New ID for ${type}, ${id}: ${newId}` );

    // Update the ID of the object itself.
    let tbl = this.getTable( type );
    tbl.reId( id, newId );
    this.saveTable( tbl );

    // Now update the relationships.
    const model = this.getModel( type );
    const fromId = this.makeId( type, id );
    const toId = this.makeId( type, newId );
    tbl.forEachRelatedObject( newId, (objId, reverseField) => {
      if( !reverseField )
        return;
      const obj = this.get( objId );
      const relTbl = this.getTable( obj._type );
      const relModel = relTbl.model;
      if( !relModel.fieldIsForeignKey( reverseField ) ) {
        relTbl.removeRelationship( obj.id, reverseField, fromId );
        relTbl.addRelationship( obj.id, reverseField, toId );
      }
      else
        relTbl.set( obj.set( reverseField, toId ) );
      this.saveTable( relTbl );
    });

    // Finally, update any references in diffs.
    // TODO: This is slow and shit.
    const diffs = this.data.getIn( ['chain', 'diffs'] );
    for( let ii = 0; ii < diffs.size; ++ii ) {
      const diff = diffs.get( ii );
      let newDiff = {
        id: [diff.id[0], diff.id[1]]
      };
      let changed = false;
      if( diff.id[0] == id ) {
        newDiff.id[0] = newId;
        changed = true;
      }
      if( diff.id[1] == id ) {
        newDiff.id[1] = newId;
        changed = true;
      }
      const relModel = this.getModel( getDiffId( diff )._type );
      for( const field of relModel.iterForeignKeys() ) {
        if( diff[field] ) {
          newDiff[field] = [diff[field][0], diff[field][1]];
          if( diff[field][0] && diff[field][0].equals( fromId ) ) {
            newDiff[field][0] = toId;
            changed = true;
          }
          if( diff[field][1] && diff[field][1].equals( fromId ) ) {
            newDiff[field][1] = toId;
            changed = true;
          }
        }
      }
      for( const field of relModel.iterManyToMany() ) {
        if( diff[field] ) {
          newDiff[field] = [diff[field][0], diff[field][1]];
          if( newDiff[field][0] && newDiff[field][0].has( fromId ) ) {
            newDiff[field][0] = newDiff[field][0].delete( fromId ).add( toId );
            changed = true;
          }
          if( newDiff[field][1] && newDiff[field][1].has( fromId ) ) {
            newDiff[field][1] = newDiff[field][1].delete( fromId ).add( toId );
            changed = true;
          }
        }
      }
      if( changed )
        this.data = this.data.updateIn( ['chain', 'diffs', ii], x => Object( {...x, ...newDiff} ) );
    }
  }

  /**
   *
   */
  /* *calcOrderedDiffs() {
     const { local } = this.data;
     let done = {};
     for( const type of Object.keys( local ) ) {
     for( const obj of local[type].objects ) {
     for( const diff of this._calcOrderedDiffs( type, obj.id, done ) )
     yield diff;
     }
     }
     } */

  /* *_calcOrderedDiffs( type, id, done={} ) {
     if( type in done && id in done[type] )
     return;
     if( !(type in done) )
     done[type] = {};
     done[type][id] = true;
     const obj = this.get( type, id );
     const { relationships = {} } = obj;
     const model = schema.getModel( type );
     for( const relType of Object.keys( relationships ) ) {
     let relData = relationships[relType].data || [];
     if( !(relData instanceof Array) )
     relData = [ relData ];
     for( const rel of relData ) {
     for( const relDiff of this._calcOrderedDiffs( relType, rel.id, done ) )
     yield relDiff;
     }
     }
     const diff = model.diff( obj, this.getServer( type, id ) );
     if( diff )
     yield diff;
     } */
}
