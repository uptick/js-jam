/**
 * Add API operations based on using a TinyAPI interface.
 */
export const makeTinyApiOps = (descr, api) => {
  for( const [model, info] of Object.entries( descr ) ) {
    info.ops = {
      ...api.crud[info.plural]
    }
  }
  return descr
}
