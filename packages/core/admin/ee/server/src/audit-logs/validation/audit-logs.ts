import { yup, validateYupSchema } from '@strapi/utils';

const ALLOWED_SORT_STRINGS = ['action:ASC', 'action:DESC', 'date:ASC', 'date:DESC'];

const validateFindManySchema = yup
  .object()
  .shape({
    page: yup.number().integer().min(1),
    pageSize: yup.number().integer().min(1).max(100),
    sort: yup.mixed().oneOf(ALLOWED_SORT_STRINGS),
  contentType: yup.string(),
  userId: yup.mixed().oneOf([yup.string(), yup.number()]),
  action: yup.string(),
  dateFrom: yup.string().matches(/\d{4}-\d{2}-\d{2}/),
  dateTo: yup.string().matches(/\d{4}-\d{2}-\d{2}/),
  })
  .required();

export const validateFindMany = validateYupSchema(validateFindManySchema, { strict: false });

export default {
  validateFindMany,
};
