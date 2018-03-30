/**
 * Add API operations based on using a TinyAPI interface.
 */
export const makeTinyApiOps = (descr, api) => {
  for(const [type, info] of Object.entries(descr)) {
    info.ops = {
      ...api.crud[`${type}@${info.version}`]
    }
  }
  return descr
}
