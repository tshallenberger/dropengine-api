import { CatalogVariant } from "@catalog/services";
import { mockUuid1, mockSku1, mockTopText, mockMiddleText, mockBottomText, mockInitial } from "./mocks";

export const mockCatalogVariant1: CatalogVariant = {
  id: mockUuid1,
  sku: mockSku1,
  image: "mock_image",
  svg: "mock_svg",
  type: "2DMetalArt",
  option1: { name: "Size", option: '18"', enabled: true },
  option2: { name: "Color", option: "Black", enabled: true },
  option3: { name: undefined, option: null, enabled: false },
  productionData: { material: "Mild Steel", route: "1", thickness: "0.06" },
  personalizationRules: [
    {
      name: "top_text",
      type: "input",
      label: mockTopText,
      options: "",
      pattern: "^[a-zA-Z0-9\\s.\\()&/]*$",
      required: true,
      maxLength: 16,
      placeholder: "Enter up to 16 characters",
    },
    {
      name: "middle_text",
      type: "input",
      label: mockMiddleText,
      options: "",
      pattern: "^[a-zA-Z0-9\\s.\\()&/]*$",
      required: true,
      maxLength: 14,
      placeholder: "Enter up to 14 characters",
    },
    {
      name: "bottom_text",
      type: "input",
      label: mockBottomText,
      options: "",
      pattern: "^[a-zA-Z0-9\\s.\\()&/]*$",
      required: true,
      maxLength: 16,
      placeholder: "Enter up to 16 characters",
    },
    {
      name: "initial",
      type: "dropdownlist",
      label: mockInitial,
      options: "A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z",
      required: true,
      maxLength: null,
      placeholder: "Select Initial",
    },
  ],
  weight: {
    units: "oz",
    dimension: 738,
  },
  manufacturingCost: {
    total: 650,
    currency: "USD",
  },
  shippingCost: {
    total: 1200,
    currency: "USD",
  },
};
