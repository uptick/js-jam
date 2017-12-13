import React, { Component } from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'

import * as modelActions from '../actions'
import DB from '../db'

/**
 * Higher-order component to automatically insert models loaded
 * from a server.
 */
export default (options) => {

  /**
   * Connect the wrapper component to the model state.
   */
  return ComposedComponent => connect(

    (state, props) => {
      const { name, schema } = options || {}
      const { model = {} } = state
      const { views = {} } = model
      const db = new DB( model.db, { schema } )
      const content = views[name] || {}

      // Default to loading to catch that little moment before we've sent off
      // the first REQUEST action.
      const { meta = {}, ...rest } = content

      // Examine the `loading` value from our props, as it will influence
      // our loading behavior.
      let { loading = true } = content
      if( props.loading ) {
        loading = true
      }

      // Start constructing the results. `delayLoad` is set by passing
      // in `loading` as true into our props. It indicates that any load
      // requests that come in should be ignored until `loading` is false.
      let results = {
        ...rest,
        loading,
        delayLoad: props.loading,
        db
      }
      return results
    },

    dispatch => bindActionCreators( modelActions, dispatch )

  )(

    class DBComponent extends Component {

      reload( props ) {

        // Only trigger a reload if we've not received `loading` as
        // true in our props.
        if( !props.delayLoad ) {
          console.debug( 'DBComponent: Loading.' )
          props.loadModelView( {...options, props} )
        }
      }

      componentWillMount() {
        this.reload( this.props )
      }

      componentWillUnmount() {
        this.props.clearModelView( options )
      }

      componentWillReceiveProps( nextProps ) {
        if( this.props.params != nextProps.params || (this.props.delayLoad && !nextProps.delayLoad) ) {
          this.reload( nextProps )
        }
      }

      render() {
        return (
          <ComposedComponent
              {...this.props}
          />
        )
      }
    }

  )

}
