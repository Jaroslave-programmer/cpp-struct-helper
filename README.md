## CppStructHelper

## Авторство
Выполнил: Самгин Ярослав Павлович
Группа: M3115
Среда разработки (IDE): Visual Studio Code

## Общее описание
CppStructHelper — плагин для Visual Studio Code, предназначенный для автоматической генерации C++ классов (по списку выделенных полей), управляющих конструкций (for, switch-case) и защитных макросов Header Guard (#ifndef).

## Возможности плагина
- CppHelper: Сгенерировать C++ класс по списку полей (Ctrl+Alt+G)
- CppHelper: Сгенерировать управляющий блок (for / switch-case) (Ctrl+Alt+B)
- CppHelper: Обернуть файл в Header Guard (#ifndef)

## Описание функций модуля
getDefaultValueForType(cppType)
Возвращает начальное значение для типа C++ по словарю Map (например, для int -> 0, для указателей -> nullptr).

parseCppFields(rawText)
Разбирает выделенные строки с полями C++ и удаляет дубликаты имен через структуру Set.

buildCppClassCode(className, fields)
Формирует код C++ класса с секцией private, конструкторами, геттерами и сеттерами.

buildControlBlock(kind, paramInput)
Генерирует блок цикла for или конструкцию switch-case по переданным параметрам.

makeHeaderGuardMacro(filePath)
Формирует имя макроса защиты заголовка по имени файла.
