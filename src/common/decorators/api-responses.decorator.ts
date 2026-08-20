import { applyDecorators, Type } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

interface ResponseOptions {
  description?: string;
  hasApiBearerToken?: boolean;
}

function getCommonDecorators(hasApiBearerToken = true) {
  return hasApiBearerToken ? [ApiBearerAuth()] : [];
}

export function ApiGetResponses(
  responseType: Type<unknown>,
  options: ResponseOptions = {},
) {
  const {
    description = 'Resource retrieved successfully',
    hasApiBearerToken = true,
  } = options;

  return applyDecorators(
    ...getCommonDecorators(hasApiBearerToken),
    ApiResponse({ status: 200, type: responseType, description }),
    ApiResponse({ status: 400, description: 'Bad Request' }),
    ApiResponse({ status: 404, description: 'Resource not found' }),
  );
}

// For GET endpoints retrieving arrays/lists (e.g., findAll)
export function ApiGetArrayResponses(
  responseType: Type<unknown>,
  options: ResponseOptions = {},
) {
  const {
    description = 'Resources retrieved successfully',
    hasApiBearerToken = true,
  } = options;

  return applyDecorators(
    ...getCommonDecorators(hasApiBearerToken),
    ApiResponse({ status: 200, type: [responseType], description }),
    ApiResponse({ status: 400, description: 'Bad Request' }),
  );
}

export function ApiPostResponses(
  responseType: Type<unknown>,
  options: ResponseOptions = {},
) {
  const {
    description = 'Resource created successfully',
    hasApiBearerToken = true,
  } = options;

  return applyDecorators(
    ...getCommonDecorators(hasApiBearerToken),
    ApiResponse({ status: 201, type: responseType, description }),
    ApiResponse({ status: 400, description: 'Bad Request' }),
    ApiResponse({ status: 404, description: 'Parent resource not found' }),
  );
}

export function ApiPatchResponses(
  responseType: Type<unknown>,
  options: ResponseOptions = {},
) {
  const {
    description = 'Resource updated successfully',
    hasApiBearerToken = true,
  } = options;

  return applyDecorators(
    ...getCommonDecorators(hasApiBearerToken),
    ApiResponse({ status: 200, type: responseType, description }),
    ApiResponse({ status: 400, description: 'Bad Request' }),
    ApiResponse({ status: 404, description: 'Resource not found' }),
  );
}

export function ApiDeleteResponses(options: ResponseOptions = {}) {
  const {
    description = 'Resource deleted successfully',
    hasApiBearerToken = true,
  } = options;

  return applyDecorators(
    ...getCommonDecorators(hasApiBearerToken),
    ApiResponse({ status: 200, description }),
    ApiResponse({ status: 400, description: 'Bad Request' }),
    ApiResponse({ status: 404, description: 'Resource not found' }),
  );
}
