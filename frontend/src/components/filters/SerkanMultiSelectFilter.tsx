import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import {
  Autocomplete,
  Checkbox,
  TextField,
  type SxProps,
  type Theme,
} from "@mui/material";

export type SerkanFilterOption = {
  value: string;
  label: string;
};

type SerkanMultiSelectFilterProps = {
  label: string;
  options: SerkanFilterOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  sx?: SxProps<Theme>;
};

export function SerkanMultiSelectFilter({
  label,
  options,
  value,
  onChange,
  placeholder = "Todos",
  disabled = false,
  sx,
}: SerkanMultiSelectFilterProps) {
  const selectedOptions = options.filter((option) =>
    value.includes(option.value),
  );

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      limitTags={2}
      options={options}
      value={selectedOptions}
      disabled={disabled}
      onChange={(_event, nextOptions) =>
        onChange(nextOptions.map((option) => option.value))
      }
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, selected) =>
        option.value === selected.value
      }
      noOptionsText="Sin coincidencias"
      renderOption={(props, option, state) => {
        const { key, ...optionProps } = props;

        return (
          <li key={key} {...optionProps}>
            <Checkbox
              icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
              checkedIcon={<CheckBoxIcon fontSize="small" />}
              checked={state.selected}
              sx={{ mr: 1 }}
            />
            {option.label}
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={selectedOptions.length === 0 ? placeholder : undefined}
        />
      )}
      sx={sx}
    />
  );
}
