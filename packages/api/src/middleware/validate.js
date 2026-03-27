/**
 * @param {import('zod').ZodSchema} schema
 * @param {'body'|'query'|'params'} source
 */
export function validate(schema, source = "body") {
  return (req, res, next) => {
    const input =
      source === "query" ? req.query : source === "params" ? req.params : req.body;
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    }
    req.validated = parsed.data;
    next();
  };
}
