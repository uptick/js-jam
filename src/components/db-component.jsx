import React, { Component } from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'

import * as modelActions from '../actions'
import DB from '../db'
import PaginatedArray from '../paginated-array'

/**
 * Higher-order component to automatically insert models loaded
 * from a server.
 */
export default (options) => {

  /**
   * Connect the wrapper component to the model state.
   */
  return ComposedComponent => connect(

    state => {
      const { name, schema } = options || {}
      const { model = {} } = state
      const { views = {} } = model
      const db = new DB( model.db, { schema } )
      const content = views[name] || {}

      // Default to loading to catch that little moment before we've sent off
      // the first REQUEST action.
      const { loading = true, meta = {}, ...rest } = content

      // Start constructing the results.
      let results = {
        ...rest,
        loading,
        db
      }

      // Check meta for pagination across our results. Any result list that
      // has pagination attached should use a PaginatedArray instead, to allow
      // easier interactions.
      /* Object.keys( rest ).forEach(
       *   name => {
       *     const { pagination, links } = meta[name] || {}
       *     if( pagination && links ) {
       *       console.debug( `DBComponent: Using pagination for ${name}` )
       *       let pa = new PaginatedArray( ...rest[name] )
       *       pa.view = name
       *       pa.page = pagination.offset
       *       pa.pageSize = pagination.limit
       *       pa.numPages = pagination.count
       *       pa.links = links
       *       results[name] = pa
       *     }
       *     else {*/
      // results[name] = rest[name]
      /* }
         }
         )*/

      return results
    },

    dispatch => bindActionCreators( modelActions, dispatch )

  )(

    class DBComponent extends Component {

      constructor( props ) {
        super( props );
        this.reload = ::this.reload;
      }

      reload( props ) {
        console.debug( 'DBComponent: Loading.' );
        props.loadModelView( {...options, props} );
      }

      componentWillMount() {
        this.reload( this.props );
      }

      componentWillUnmount() {
        this.props.clearModelView( options );
      }

      componentWillReceiveProps( nextProps ) {
        if( this.props.params != nextProps.params )
          this.reload( nextProps );
      }

      render() {
        return (
          <ComposedComponent
              {...this.props}
          />
        );
      }
    }

  );

}
