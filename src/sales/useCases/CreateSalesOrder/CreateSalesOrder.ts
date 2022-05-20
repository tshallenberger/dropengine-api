import {
  Injectable,
  Logger,
  NotImplementedException,
  Scope,
} from "@nestjs/common";
import { UseCase } from "@shared/domain";
import { AzureTelemetryService } from "@shared/modules";
import { SalesOrder } from "@sales/domain";
import { CreateOrderLineItemApiDto } from "@sales/api";
import { CatalogVariant } from "@catalog/services";

import {
  CreateOrderDto,
  CreateLineItemDto,
  CustomerDto,
  AddressDto,
} from "@sales/dto";
import { validate } from "class-validator";
import { CreateSalesOrderDto } from "../../dto/CreateSalesOrderDto";
import safeJsonStringify from "safe-json-stringify";
import { SalesOrderRepository } from "@sales/database/SalesOrderRepository";
import { CreateSalesOrderLineItemDto } from "@sales/dto/CreateSalesOrderLineItemDto";
import { CreateSalesOrderError } from "./CreateSalesOrderError";
import { CreateSalesOrderException } from "./CreateSalesOrderException";
import { FailedToPlaceSalesOrderException } from "./FailedToPlaceSalesOrderException";
import { generateValidationError } from "./generateValidationError";
import { SalesOrderPlaced } from "@sales/domain/DomainEvents/OrderPlaced";

@Injectable({ scope: Scope.DEFAULT })
export class CreateSalesOrder
  implements UseCase<CreateSalesOrderDto, SalesOrder>
{
  private readonly logger: Logger = new Logger(CreateSalesOrder.name);
  constructor(
    public _log: AzureTelemetryService,
    public _repo: SalesOrderRepository
  ) {}

  async execute(dto: CreateSalesOrderDto): Promise<SalesOrder> {
    try {
      await this.validateUseCaseDto(dto);

      // Load Variants, Generate LineItems
      const lineItems: CreateLineItemDto[] = [];
      for (let i = 0; i < dto.lineItems.length; i++) {
        const li = dto.lineItems[i];
        const catalogVariant = await this.loadCatalogVariant(li);
        const cli = new CreateLineItemDto();
        cli.lineNumber = i + 1;
        cli.properties = li.lineItemProperties;
        cli.quantity = li.quantity;
        cli.variant = catalogVariant;
        lineItems.push(cli);
      }

      // Generate the DTO
      const cdto: CreateOrderDto = new CreateOrderDto();
      cdto.accountId = dto.accountId;

      cdto.billingAddress = new AddressDto(dto.billingAddress);
      cdto.shippingAddress = new AddressDto(dto.shippingAddress);
      cdto.customer = Object.assign(new CustomerDto(), dto.customer);
      cdto.lineItems = lineItems;
      cdto.orderDate = dto.orderDate;
      cdto.orderName = dto.orderName;
      cdto.orderNumber = dto.orderNumber;

      await this.validateDomainDto(cdto);

      // Create/Save the SalesOrder
      let order = new SalesOrder();
      order = await this._repo.save(order);

      // Generate/Raise OrderPlaced event
      let $event = new SalesOrderPlaced(order.id, cdto);
      // order.raise($event);

      return await this._repo.save(order);
    } catch (error) {
      if (process.env.DEBUG)
        this.logger.error(safeJsonStringify(error, null, 2));
      if (weRecognize(error)) throw error;
      else {
        throw new FailedToPlaceSalesOrderException(
          dto,
          `An unexpected error has occurred.`
        );
      }
    }

    function weRecognize(error: any) {
      return error instanceof CreateSalesOrderException;
    }
  }

  public async validateUseCaseDto(dto: CreateSalesOrderDto) {
    const dtoErrors = await validate(dto, {
      validationError: { target: false },
    });
    if (dtoErrors.length) {
      const message = `Validation errors found.`;
      const valErrors = generateValidationError(dtoErrors);
      throw new FailedToPlaceSalesOrderException(
        dto,
        message,
        CreateSalesOrderError.InvalidSalesOrder,
        valErrors
      );
    }
  }
  public async validateDomainDto(createOrderDto: CreateOrderDto) {
    const validationErrors = await validate(createOrderDto, {
      validationError: { target: false },
    });
    if (validationErrors.length) {
      const reason = `Validation errors found.`;
      const valErrors = generateValidationError(validationErrors);
      if (process.env.DEBUG) console.log(safeJsonStringify(valErrors, null, 2));
      throw new FailedToPlaceSalesOrderException(
        createOrderDto,
        reason,
        CreateSalesOrderError.InvalidSalesOrder,
        valErrors
      );
    }
  }

  public async loadCatalogVariant(
    li: CreateOrderLineItemApiDto
  ): Promise<CatalogVariant> {
    const variantResult = hasSku()
      ? await this.loadVariantBySku(li.sku)
      : await this.loadVariantById(li.variantId);

    return variantResult;

    function hasSku() {
      return li.sku != null;
    }
  }
  public async loadVariantBySku(sku: string): Promise<CatalogVariant> {
    //return await this._catalog.loadVariantBySku({ sku });
    throw new NotImplementedException();
  }

  public async loadVariantById(id: string): Promise<CatalogVariant> {
    // return await this._catalog.loadVariantById({ id });
    throw new NotImplementedException();
  }
}
