# Order Create Page – Inputs Reference (Backend)

All form inputs collected on `/orders/create` and what is sent to the API.

---

## 1. Contact information (Холбоо барих мэдээлэл)

| Field (Mongolian) | Key / Backend name | Type | Required | Sent in create order? | Notes |
|-------------------|--------------------|------|----------|------------------------|-------|
| Нэр               | `fullName`         | `string` | Yes | **Yes** | Sent in create order for both auth and guest (current input) |
| Утасны дугаар     | `phoneNumber`      | `string` | Yes | **Yes** | Exactly 8 digits; sent in create order for both auth and guest |
| И-мэйл хаяг       | `email`            | `string` | Yes | **Yes** | Sent in create order for both auth and guest; also stored in localStorage |

- **Authenticated:** `userName` → `fullName`, `userPhone` → `phoneNumber`, `userEmail` → `email` (all sent in create order from current inputs).
- **Guest:** `guestAddress.fullName` → `fullName`, `guestAddress.phoneNumber` → `phoneNumber`, `guestAddress.email` → `email` (all sent in create order from current inputs).

---

## 2. Delivery address (Хүргэлт хүлээн авах мэдээлэл)

### Authenticated user

- **Existing address:** only `selectedAddressId` (number) is sent; no address object.
- **New address (when user has no addresses):** address is created via **Create Address** API first; then create order sends only `addressId`. Create Address payload uses the same shape as below (with `fullName`, `phoneNumber` from contact).

### Guest user – inline address (all in create-order `address` object)

| Field (Mongolian) | Key | Type | Required | Notes |
|-------------------|-----|------|----------|--------|
| Хаягийн нэр | `label` | `string` | **Yes** | Required on frontend |
| (Нэр from contact) | `fullName` | `string` | Yes | From contact section |
| (Утас from contact) | `phoneNumber` | `string` | Yes | 8 digits, from contact section |
| Аймаг/Дүүрэг | `provinceOrDistrict` | `string` | Yes | From districts API |
| Хороо/Сум | `khorooOrSoum` | `string` | Yes | From khoroo API (depends on district) |
| Хотхон | `residentialComplex` | `string` | No | Optional |
| Барилга | `building` | `string` | No | Optional |
| Орц | `entrance` | `string` | No | Optional |
| Тоот | `apartmentNumber` | `string` | No | Optional |
| Дэлгэрэнгүй хаяг | `addressNote` | `string` | No | Max 500 chars |
| (not in guest form) | `street` | `string` | No | Not collected; can be omitted or empty |
| (not in guest form) | `neighborhood` | `string` | No | Not collected; can be omitted or empty |

### Authenticated – new address form (Create Address API)

| Field (Mongolian) | Key | Type | Required |
|-------------------|-----|------|----------|
| Хаягийн нэр | `label` | `string` | **Yes** |
| Дүүрэг | `provinceOrDistrict` | `string` | Yes |
| Хороо/Сум | `khorooOrSoum` | `string` | Yes |
| Хотхон | `residentialComplex` | `string` | No |
| Барилга | `building` | `string` | No |
| Орц | `entrance` | `string` | No |
| Тоот | `apartmentNumber` | `string` | No |
| Дэлгэрэнгүй хаяг | `addressNote` | `string` | No (max 500) |
| (from contact) | `fullName` | `string` | Yes |
| (from contact) | `phoneNumber` | `string` | Yes (8 digits) |

- `street` and `neighborhood` are in the type but not collected in this form; backend can accept optional.

---

## 3. Delivery date and time

| Field (Mongolian) | Key | Type | Required | Values / format |
|-------------------|-----|------|----------|-------------------|
| Хүргэлтийн өдөр | `deliveryDate` | `string` | Yes | `YYYY-MM-DD` (ISO date) |
| Цаг сонгох | `deliveryTimeSlot` | `string` | Yes | One of: `'10-14'` \| `'14-18'` \| `'18-21'` \| `'21-00'` |

---

## Backend payloads (what the frontend actually sends)

### Create Order – authenticated user

```ts
{
  addressId: number;           // required – selected saved address
  fullName: string;            // required – from contact section (current input)
  phoneNumber: string;         // required – 8 digits, from contact section (current input)
  email: string;               // required – from contact section (current input)
  deliveryDate: string;       // "YYYY-MM-DD"
  deliveryTimeSlot: "10-14" | "14-18" | "18-21" | "21-00";
}
```

- If user had no addresses, the frontend first calls **Create Address** with `CreateAddressRequest`; then sends the returned `addressId` in this payload.
- `fullName`, `phoneNumber`, and `email` are from the contact section (current input values).

### Create Order – guest user

```ts
{
  address: {
    fullName: string;
    phoneNumber: string;       // 8 digits
    provinceOrDistrict: string;
    khorooOrSoum: string;
    street?: string;           // not collected, omit or ""
    neighborhood?: string;     // not collected, omit or ""
    residentialComplex?: string;
    building?: string;
    entrance?: string;
    apartmentNumber?: string;
    addressNote?: string;
    label?: string;            // not collected for guest, omit or ""
  };
  fullName: string;            // required – from contact section (current input)
  phoneNumber: string;         // required – 8 digits, from contact section (current input)
  email: string;               // required – from contact section (current input)
  deliveryDate: string;       // "YYYY-MM-DD"
  deliveryTimeSlot: "10-14" | "14-18" | "18-21" | "21-00";
  sessionToken?: string;      // added by frontend if guest has session
}
```

- **fullName**, **phoneNumber**, and **email** are required in the payload (from contact section); email also stored in localStorage.

### Create Address – authenticated user (used when user has no addresses)

```ts
{
  fullName: string;
  phoneNumber: string;         // 8 digits
  provinceOrDistrict: string;
  khorooOrSoum: string;
  label?: string;
  street?: string;
  neighborhood?: string;
  residentialComplex?: string;
  building?: string;
  entrance?: string;
  apartmentNumber?: string;
  addressNote?: string;
  isDefault?: boolean;
}
```

---

## Summary table – inputs by type

| Input | Type | Required (frontend) | Sent to backend |
|-------|------|----------------------|------------------|
| fullName | string | Yes | **Always** (create order for both auth and guest; current input) |
| phoneNumber | string (8 digits) | Yes | **Always** (create order for both auth and guest; current input) |
| email | string (email) | Yes | **Always** (create order for both auth and guest; current input) |
| provinceOrDistrict | string | Yes (for address) | Guest: in `address`; Auth: in Create Address |
| khorooOrSoum | string | Yes (for address) | Same |
| residentialComplex | string | No | Same |
| building | string | No | Same |
| entrance | string | No | Same |
| apartmentNumber | string | No | Same |
| addressNote | string | No (max 500) | Same |
| label | string | **Yes** | Guest: in `address`; Auth: in Create Address (required on frontend) |
| deliveryDate | string | Yes | Always in Create Order |
| deliveryTimeSlot | enum | Yes | Always in Create Order |
| addressId | number | Yes (auth with addresses) | Create Order (auth) |
