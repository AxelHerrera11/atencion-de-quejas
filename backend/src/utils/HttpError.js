/** Error con código HTTP para responder de forma controlada al cliente. */
export class HttpError extends Error {
  constructor(status, mensaje, detalles = undefined) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }
}
