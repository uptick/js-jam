/**
 * Array-like class to manage paginated results.
 */
export default class PaginatedArray extends Array {

  constructor( ...args ) {
    super( ...args )
    this.page = null
    this.numPages = null
    this.pageSize = null
    this.loading = false
    /* if( arguments.length > 1 || (arguments.length == 1 && !Number.isInteger( arguments[0] )) ) {
     * }*/
  }

  /**
   * Flag indicating if a page is loading.
   */
  isLoading() {
    return this.loading
  }

  /**
   * The current page.
   */
  getPage() {
    return this.page
  }

  /**
   * The total number of pages.
   */
  getNumPages() {
    return this.numPages
  }

  /**
   * The number of items per page.
   */
  getPageSize() {
    return this.pageSize
  }

  /**
   * Move to the next page.
   */
  nextPage() {
  }

  /**
   * Move to the previous page.
   */
  prevPage() {
  }
}
