import {
  UseInterceptors,
  UseGuards,
  Controller,
  Inject,
  Get,
  Post,
  Delete,
  Body,
  Res,
  Param,
  Query,
  ConflictException,
  HttpStatus,
  UnauthorizedException,
  LoggerService,
  Logger,
  Patch,
  NotImplementedException,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { Versions } from "@shared/Constants";
import { EntityNotFoundException } from "@shared/exceptions";
import { Request, Response as ExpressResponse } from "express";
import {
  DeleteSalesOrder,
  GetSalesOrder,
  QuerySalesOrders,
} from "../useCases/CRUD";
import { CreateSalesOrder } from "../useCases/CreateSalesOrder/CreateSalesOrder";
import { CreateOrderValidationPipe } from "./middleware";
import {
  CancelOrderApiDto,
  CreateOrderApiDto,
  EditCustomerDto,
  EditPersonalizationDto,
  EditShippingAddressDto,
  QueryOrdersDto,
  QueryOrdersResponseDto,
} from "./model";
import { User } from "@shared/decorators";
import { AuthenticatedUser } from "@shared/decorators/AuthenticatedUser";
import { SalesLoggingInterceptor } from "./middleware/SalesLoggingInterceptor";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { CreateSalesOrderDto } from "@sales/dto/CreateSalesOrderDto";
import { UpdatePersonalization } from "@sales/useCases/UpdatePersonalization";
import { UpdateShippingAddress } from "@sales/useCases";
import { FailedToPlaceSalesOrderException } from "@sales/useCases/CreateSalesOrder/FailedToPlaceSalesOrderException";
import { CreateSalesOrderError } from "@sales/useCases/CreateSalesOrder/CreateSalesOrderError";

@UseGuards(AuthGuard())
@UseInterceptors(SalesLoggingInterceptor)
@Controller({ path: "sales/orders", version: Versions.v1 })
export class OrdersController {
  private readonly logger: Logger = new Logger(OrdersController.name);

  constructor(
    @Inject(REQUEST) private readonly request: Request,
    private readonly create: CreateSalesOrder,
    private readonly load: GetSalesOrder,
    private readonly query: QuerySalesOrders,
    private readonly remove: DeleteSalesOrder,
    private readonly updateShipping: UpdateShippingAddress,
    private readonly updatePersonalization: UpdatePersonalization
  ) {}

  @Get(":id")
  async getById(@Param("id") id: string) {
    let result = await this.load.execute(id);
    const aggregate = result;
    return aggregate.props();
  }
  @Get()
  async get(@Query() query: QueryOrdersDto) {
    let result = await this.query.execute(query);
    return new QueryOrdersResponseDto(query, result);
  }
  @Patch(":id/lineItems/:lid/personalization")
  async patchPersonalization(
    @Param("id") id: string,
    @Param("lid") lid: string,
    @Body() dto: EditPersonalizationDto
  ) {
    let order = await this.updatePersonalization.execute({
      orderId: id,
      lineItemId: lid,
      personalization: dto.personalization,
    });
    return order.props();
  }
  @Patch(":id/customer")
  async patchCustomer(@Param("id") id: string, @Body() dto: EditCustomerDto) {
    throw new NotImplementedException({ dto, id });
  }
  @Patch(":id/shippingAddress")
  async patchShippingAddress(
    @Param("id") id: string,
    @Body() dto: EditShippingAddressDto
  ) {
    const order = await this.updateShipping.execute({
      orderId: id,
      shippingAddress: dto.shippingAddress,
    });
    return order.props();
  }
  @Post(":id/send")
  async postSend(@Param("id") id: string, @Body() dto: any) {
    throw new NotImplementedException({ dto, id });
  }
  @Post(":id/recall")
  async postRecall(@Param("id") id: string, @Body() dto: CancelOrderApiDto) {
    throw new NotImplementedException({ dto, id });
  }
  @Post(":id/cancel")
  async postCancel(
    @Param("id") id: string,
    @Body() dto: EditPersonalizationDto
  ) {
    throw new NotImplementedException({ dto, id });
  }

  @Delete(":id")
  async delete(@Param("id") id: string) {
    let result = await this.remove.execute(id);
    return result;
  }
  @Post()
  async post(
    @Res() res: ExpressResponse,
    @User() user: AuthenticatedUser,
    @Body(CreateOrderValidationPipe) dto: CreateOrderApiDto
  ) {
    if (!user.canManageOrders(dto.accountId)) {
      throw new FailedToPlaceSalesOrderException(
        dto,
        `User '${user.email}' not authorized to place orders for given Account: '${dto.accountId}'`,
        CreateSalesOrderError.UserNotAuthorizedForAccount
      );
    }
    const useCaseDto = new CreateSalesOrderDto();
    useCaseDto.accountId = dto.accountId;
    useCaseDto.orderName = dto.orderName;
    useCaseDto.orderDate = dto.orderDate;
    useCaseDto.orderNumber = dto.orderNumber;
    useCaseDto.customer = dto.customer;
    useCaseDto.lineItems = dto.lineItems;
    useCaseDto.shippingAddress = dto.shippingAddress;
    useCaseDto.billingAddress = dto.billingAddress;
    let order = await this.create.execute(useCaseDto);
    return res.status(HttpStatus.CREATED).json(order.props());
  }

  public validateUserAuthorization(
    user: AuthenticatedUser,
    accountId: string
  ) {}
}
