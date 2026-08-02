import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

import { DomainError } from "../domain/domain-error";

/**
 * Traduit les exceptions en réponses HTTP sûres (Handbook 2.6) : jamais de
 * stack trace ou de détail technique brut renvoyé au client, uniquement dans
 * les logs. Les erreurs métier typées du Domaine (DomainError) sont
 * traduites ici en codes HTTP appropriés — c'est le seul endroit du code où
 * cette traduction a lieu, jamais dans un UseCase ou un controller.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json(exception.getResponse());
      return;
    }

    if (exception instanceof DomainError) {
      response.status(exception.httpStatus).json({
        statusCode: exception.httpStatus,
        message: exception.message,
      });
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
    });
  }
}
