import { CreateOrderDto } from "@sales/dto";
import {
  mockCatalogVariant1,
  mockUuid1,
  mockAddress,
  mockTopText,
  mockMiddleText,
  mockBottomText,
  mockInitial,
  mockLineItem,
} from "@sales/mocks";
import { cloneDeep } from "lodash";
import { AuthenticatedUser } from "@shared/decorators";
import { CreateSalesOrderDto } from "@sales/dto/CreateSalesOrderDto";
import { createSalesOrderDto } from "@sales/useCases/CreateSalesOrder/fixtures";
import { SalesOrder } from "@sales/domain";

export function newMockInvalidCreateSalesOrderDto() {
  const mockAccountId = mockUuid1;
  const mockShipping = mockAddress;
  const mockBilling = mockAddress;
  const mockLi1 = cloneDeep(mockLineItem);
  mockLi1.sku = mockCatalogVariant1.sku;
  mockLi1.lineItemProperties = [
    { name: mockTopText, value: "ValidText" },
    { name: mockMiddleText, value: "ValidText" },
    { name: mockBottomText, value: "ValidText" },
    { name: mockInitial, value: "M" },
  ];

  const mockDto: CreateSalesOrderDto = {
    accountId: mockAccountId,
    orderName: null,
    orderDate: null,
    orderNumber: null,
    customer: null,
    lineItems: [mockLi1],
    shippingAddress: null,
    billingAddress: null,
  };
  const mockSalesOrderDto1: CreateOrderDto = cloneDeep(createSalesOrderDto);
  const mockSalesOrder1 = new SalesOrder();
  return mockDto;
}
