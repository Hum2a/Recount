/**
 * @param {import('zod').ZodSchema} schema
 * @param {'body'|'query'} source
 */
export function validate(schema, source = "body") {
  return (req, res, next) => {
    const parsed = schema.safeParse(source === "query" ? req.query : req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    }
    req.validated = parsed.data;
    next();
  };
}
