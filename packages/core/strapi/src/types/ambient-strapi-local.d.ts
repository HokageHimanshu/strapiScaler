declare module '@strapi/generators' {
  const value: any;
  export = value;
}

declare module '@strapi/cloud-cli' {
  export const buildStrapiCloudCommands: any;
  export const cli: any;
  export const services: any;
  export const createGrowthSsoTrial: any;
  const value: any;
  export default value;
}

declare module '@strapi/openapi' {
  const value: any;
  export = value;
}

declare module '@strapi/utils' {
  export const yup: any;
  export const validateYupSchema: any;
  export const env: any;
  export const generateInstallId: any;
  export const errors: any;
  export const strings: any;
  export const sanitize: any;
  const defaultExport: any;
  export default defaultExport;
}
