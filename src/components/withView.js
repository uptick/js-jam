import React from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import {fromJS} from 'immutable'

import * as modelActions from '../actions'
import DB from '../db'

/**
 * Higher-order component to automatically insert models loaded
 * from a server.
 */
export default options => {

  /**
   * Connect the wrapper component to the model state.
   */
  return ComposedComponent => connect(

    (state, props) => {
      const { name, schema } = options || {}
      const { model = {} } = state
      const { views = {} } = model
      const db = props.db || new DB( model.db, {schema} )
      const content = views[name] || {queries: {}}

      // Default to loading to catch that little moment before we've sent off
      // the first REQUEST action.
      /* const { meta = {}, queries, loading = !!options.queries } = content */

      // Examine the `loading` value from our props, as it will influence
      // our loading behavior. Only flag that we're loading by default if
      // we've been given a query.
      let { loading = !!options.queries } = content
      if( props.loading ) {
        loading = true
      }

      // Start constructing the results. `delayLoad` is set by passing
      // in `loading` as true into our props. It indicates that any load
      // requests that come in should be ignored until `loading` is false.
      let results = {db}
      if (name) {
        results[name] = {
          ...content,
          loading,
          delayLoad: props.loading
        }
      }
      return results
    },

    dispatch => ({
      ...bindActionCreators(modelActions, dispatch),
      ...bindActionCreators({
        updateView: (...args) => {
          return {
            type: 'MODEL_LOAD_VIEW',
            payload: {
              schema: options.schema,
              name: options.name,
              queries: (args.length == 1) ? args[0] : options.queries
            }
          }
        }
      }, dispatch )
    })

  )(

    class InnerComponent extends React.Component {

      constructor(props) {
        super(props)
        this.state = {
          params: {}
        }
        this.reload(props)
      }

      reload(props, params = {}) {

        // Only trigger a reload if we've not received `loading` as
        // true in our props, and we actually have a query in the
        // options.
        if (!props.delayLoad && options.queries) {
          console.debug('Loading JAM view.')
          props.loadModelView({...options, props, params})
        }
      }

      componentWillMount() {
//        this.reload( this.props )
      }

      componentWillUnmount() {
        this.props.clearModelView(options)
      }

      updateParams = params => {
        if (!fromJS(this.state.params).equals(fromJS(params))) {
          this.reload(this.props, params)
          this.setState({params})
        }
      }

      /**
       * Reload the database when things have changed.
       *
       * The triggers for reloading the database are:
       *
       *   * any part of our local database cache has changed, or
       *   * we are not currently loading.
       *
       * These ensure if a load request was made manually, so long as
       * we're not already performing a load it will be respected, and
       * if new information is in our database it will respond to those
       * changes, and it will also stop infinite loading from occurring.
       *
       * TODO: I want to minimise these loads, so three things can be done.
       *   First I can maybe use a selector to limit the database
       *   comparison, making sure it only reloads when something
       *   relevant has changed. Secondly, I could try and coalesce the
       *   requests for reloading. Lastly, when the local DB is all
       *   that's changed (i.e. we're still loading) I can queue up a
       *   a local reload only.
       */
      componentWillReceiveProps(nextProps) {
        const {name} = options
        if(name) {
          if(!this.props.db.equals(nextProps.db))
            this.reload(nextProps)
        }
      }

      render() {
        return (
          <ComposedComponent
            updateViewParams={this.updateParams}
            {...this.props}
          />
        )
      }
    }

  )

}
