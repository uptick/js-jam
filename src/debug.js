export function executionTime(callback, id) {
  const t0 = performance.now()
  const r = callback()
  const t = performance.now() - t0
  let msg
  if (id)
    msg = `  -- ${id} took ${t} ms to execute.`
  else
    msg = `  -- Took ${t} ms to execute.`
  console.debug(msg)
  return r
}
